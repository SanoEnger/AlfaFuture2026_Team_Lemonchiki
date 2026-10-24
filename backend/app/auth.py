"""Password PBKDF2 and short-lived signed demo access tokens."""
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
import uuid
import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import get_db
from .errors import ApiError
from .models import User

_ITERATIONS = 260_000
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, _ITERATIONS)
    return 'pbkdf2_sha256$%s$%s$%s' % (_ITERATIONS, base64.urlsafe_b64encode(salt).decode(), base64.urlsafe_b64encode(digest).decode())


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, rounds, salt_b64, expected_b64 = password_hash.split('$')
        if algo != 'pbkdf2_sha256':
            return False
        salt = base64.urlsafe_b64decode(salt_b64)
        expected = base64.urlsafe_b64decode(expected_b64)
        real = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, int(rounds))
        return hmac.compare_digest(real, expected)
    except (ValueError, TypeError):
        return False


def secret_key() -> str:
    secret = os.getenv('APP_SECRET_KEY', '')
    if len(secret) < 32:
        raise RuntimeError('Set APP_SECRET_KEY with at least 32 random characters')
    return secret


def issue_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub': str(user.id), 'sv': user.session_version, 'iat': now, 'exp': now + timedelta(minutes=60)}, secret_key(), algorithm='HS256')


def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if credentials is None:
        from .security import cookie_user
        return cookie_user(request, db)
    try:
        claims = jwt.decode(credentials.credentials, secret_key(), algorithms=['HS256'])
        user_id = uuid.UUID(claims['sub'])
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise ApiError('UNAUTHORIZED', 'Недействительный токен', 401) from None
    user = db.get(User, user_id)
    if user is None or user.status != 'ACTIVE' or claims.get('sv', 1) != user.session_version:
        raise ApiError('UNAUTHORIZED', 'Пользователь не найден', 401)
    return user


def require_role(role: str):
    def dependency(user: User = Depends(current_user)) -> User:
        permitted = {role}
        if role == 'BANK_EMPLOYEE':
            permitted.update(('BANK_OFFICER', 'BANK_ADMIN'))
        if user.role not in permitted:
            raise ApiError('FORBIDDEN', 'Недостаточно прав', 403)
        return user
    return dependency
