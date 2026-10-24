"""Opaque database sessions and CSRF protection for the web application."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from .models import AuthSession, User, AuditEvent
from .errors import ApiError

SESSION_COOKIE = 'finmarshrut_session'
CSRF_COOKIE = 'finmarshrut_csrf'
IDLE_SECONDS = int(os.getenv('SESSION_IDLE_SECONDS', '1800'))
ABSOLUTE_SECONDS = int(os.getenv('SESSION_ABSOLUTE_SECONDS', '43200'))


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def secret() -> bytes:
    value = os.getenv('APP_SECRET_KEY', '')
    if len(value) < 32:
        raise RuntimeError('APP_SECRET_KEY must contain at least 32 characters')
    return value.encode()


def csrf_token() -> str:
    payload = secrets.token_urlsafe(32)
    return payload + '.' + hmac.new(secret(), payload.encode(), hashlib.sha256).hexdigest()


def valid_csrf(value: str) -> bool:
    try:
        payload, signature = value.rsplit('.', 1)
        return len(payload) >= 32 and hmac.compare_digest(signature, hmac.new(secret(), payload.encode(), hashlib.sha256).hexdigest())
    except (ValueError, TypeError):
        return False


def check_csrf(request: Request) -> str:
    cookie = request.cookies.get(CSRF_COOKIE, '')
    supplied = request.headers.get('X-CSRF-Token', '')
    origin = request.headers.get('origin')
    allowed = {x.strip() for x in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')}
    same_origin = str(request.base_url).rstrip('/')
    if origin and origin not in allowed and origin != same_origin:
        raise ApiError('FORBIDDEN', 'Источник запроса не разрешён', 403)
    if not cookie or not supplied or not hmac.compare_digest(cookie, supplied) or not valid_csrf(cookie):
        raise ApiError('FORBIDDEN', 'Обновите страницу и повторите действие', 403)
    return supplied


def set_csrf(response: Response, token: str):
    response.set_cookie(CSRF_COOKIE, token, httponly=False, secure=os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true', samesite='lax', max_age=ABSOLUTE_SECONDS, path='/')


def start_session(db: Session, user: User, response: Response):
    raw = secrets.token_urlsafe(48)
    csrf = csrf_token()
    now = datetime.now(timezone.utc)
    db.add(AuthSession(user_id=user.id, token_hash=digest(raw), csrf_hash=digest(csrf), expires_at=now + timedelta(seconds=IDLE_SECONDS), absolute_expires_at=now + timedelta(seconds=ABSOLUTE_SECONDS)))
    response.set_cookie(SESSION_COOKIE, raw, httponly=True, secure=os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true', samesite='lax', max_age=ABSOLUTE_SECONDS, path='/')
    set_csrf(response, csrf)
    return csrf


def cookie_user(request: Request, db: Session) -> User:
    raw = request.cookies.get(SESSION_COOKIE, '')
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == digest(raw))) if raw else None
    now = datetime.now(timezone.utc)
    if not session or session.revoked or aware(session.expires_at) <= now or aware(session.absolute_expires_at) <= now:
        raise ApiError('UNAUTHORIZED', 'Войдите в кабинет', 401)
    user = db.get(User, session.user_id)
    if not user or user.status != 'ACTIVE':
        raise ApiError('UNAUTHORIZED', 'Доступ к аккаунту закрыт', 401)
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        value = check_csrf(request)
        if not hmac.compare_digest(digest(value), session.csrf_hash):
            raise ApiError('FORBIDDEN', 'Обновите страницу и повторите действие', 403)
    session.expires_at = min(now + timedelta(seconds=IDLE_SECONDS), aware(session.absolute_expires_at))
    db.commit()
    return user


def revoke_sessions(db: Session, user: User):
    user.session_version += 1
    db.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked=True))


def audit(db: Session, actor: User | None, action: str, object_id: str, detail: str = ''):
    db.add(AuditEvent(actor_id=actor.id if actor else None, action=action, object_id=object_id, detail=detail))
