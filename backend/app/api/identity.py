"""Account lifecycle and staff permissions backed by the application database."""
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import os
import re
import secrets
import smtplib
from threading import Lock
import time
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from ..auth import current_user, hash_password, verify_password
from ..db import get_db
from ..errors import ApiError
from ..models import User, Company, IdentityToken, AuditEvent
from ..security import (SESSION_COOKIE, CSRF_COOKIE, aware, audit, check_csrf, csrf_token, digest,
                        revoke_sessions, set_csrf, start_session, valid_csrf)

router = APIRouter(prefix='/api/v1', tags=['accounts'])
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]
_buckets = defaultdict(deque)
_bucket_lock = Lock()


def throttle(request: Request):
    key = (request.client.host if request.client else '', request.url.path)
    now = time.monotonic()
    with _bucket_lock:
        if len(_buckets) > 10000:
            _buckets.clear()
        bucket = _buckets[key]
        while bucket and bucket[0] < now - 300:
            bucket.popleft()
        if len(bucket) >= int(os.getenv('AUTH_RATE_LIMIT', '12')):
            raise ApiError('RATE_LIMITED', 'Слишком много попыток. Попробуйте позже.', 429)
        bucket.append(now)


def public_command(request: Request):
    throttle(request)
    check_csrf(request)


def email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        raise ApiError('VALIDATION_ERROR', 'Укажите корректный email', 422)
    return value


def password(value: str):
    if not 10 <= len(value) <= 24 or not re.search(r'[A-Za-zА-Яа-я]', value) or not re.search(r'\d', value):
        raise ApiError('VALIDATION_ERROR', 'Пароль должен содержать 10–24 символа, буквы и цифры', 422)


def admin(user: User):
    if user.role != 'BANK_ADMIN':
        raise ApiError('FORBIDDEN', 'Требуются права администратора', 403)


def account(user: User):
    return {'id': str(user.id), 'email': user.email or '', 'displayName': user.display_name or user.username,
            'role': user.role, 'status': user.status, 'createdAt': aware(user.created_at).isoformat(),
            'lastLogin': aware(user.last_login_at).isoformat() if user.last_login_at else None}


def deliver(to: str, subject: str, path: str):
    origin = os.getenv('PUBLIC_APP_URL', 'http://localhost:5173').rstrip('/')
    message = EmailMessage()
    message['Subject'] = 'ФинМаршрут — ' + subject
    message['From'] = os.getenv('MAIL_FROM', 'noreply@finmarshrut.test')
    message['To'] = to
    message.set_content(f'{subject}\n\nОткройте ссылку:\n{origin}{path}\n\nЕсли вы не запрашивали это действие, проигнорируйте письмо.')
    try:
        with smtplib.SMTP(os.getenv('SMTP_HOST', 'localhost'), int(os.getenv('SMTP_PORT', '1025')), timeout=10) as smtp:
            if os.getenv('SMTP_STARTTLS', 'false').lower() == 'true':
                smtp.starttls()
            if os.getenv('SMTP_USERNAME'):
                smtp.login(os.environ['SMTP_USERNAME'], os.environ.get('SMTP_PASSWORD', ''))
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        raise ApiError('MAIL_UNAVAILABLE', 'Не удалось отправить письмо. Попробуйте позже.', 503) from None


def issue(db: Session, target: str, kind: str, user: User | None = None, inviter: User | None = None):
    raw = secrets.token_urlsafe(48)
    existing = db.scalars(select(IdentityToken).where(IdentityToken.email == target, IdentityToken.kind == kind, IdentityToken.used_at.is_(None))).all()
    for token in existing:
        token.revoked = True
    token = IdentityToken(user_id=user.id if user else None, email=target, kind=kind, token_hash=digest(raw), expires_at=datetime.now(timezone.utc) + timedelta(hours=48 if kind == 'invitation' else 1), invited_by=inviter.id if inviter else None)
    db.add(token)
    return raw, token


def token_of(db: Session, raw: str, kind: str):
    token = db.scalar(select(IdentityToken).where(IdentityToken.token_hash == digest(raw), IdentityToken.kind == kind).with_for_update())
    if not token or token.revoked or token.used_at or aware(token.expires_at) <= datetime.now(timezone.utc):
        raise ApiError('INVALID_TOKEN', 'Ссылка недействительна, использована или срок её действия истёк', 422)
    return token


class Register(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=24)


class Login(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class EmailInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class TokenInput(BaseModel):
    token: str = Field(min_length=16, max_length=512)


class Reset(TokenInput):
    password: str = Field(min_length=10, max_length=24)


class AcceptInvitation(Reset):
    name: str = Field(min_length=1, max_length=100)


class Profile(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ChangePassword(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=10, max_length=24)


@router.get('/auth/csrf')
def csrf(request: Request, response: Response):
    value = request.cookies.get(CSRF_COOKIE, '')
    if not valid_csrf(value):
        value = csrf_token()
        set_csrf(response, value)
    return {'csrf_token': value}


@router.post('/auth/register', status_code=202)
def register(body: Register, request: Request, db: Db):
    public_command(request)
    target = email(body.email)
    password(body.password)
    if not body.name.strip():
        raise ApiError('VALIDATION_ERROR', 'Укажите имя', 422)
    existing = db.scalar(select(User).where(func.lower(User.email) == target))
    if existing:
        return {'message': 'Если адрес доступен для регистрации, письмо отправлено'}
    user = User(username='u_' + uuid.uuid4().hex, email=target, display_name=body.name.strip(), password_hash=hash_password(body.password), role='CLIENT', status='PENDING')
    db.add(user)
    db.flush()
    raw, token = issue(db, target, 'verify', user)
    deliver(target, 'Подтверждение email', '/verify-email?token=' + raw)
    audit(db, user, 'Аккаунт создан', str(user.id))
    db.commit()
    return {'message': 'Если адрес доступен для регистрации, письмо отправлено'}


@router.post('/auth/verify-email')
def verify(body: TokenInput, request: Request, db: Db):
    public_command(request)
    token = token_of(db, body.token, 'verify')
    user = db.get(User, token.user_id)
    if not user or user.status != 'PENDING':
        raise ApiError('INVALID_TOKEN', 'Ссылка недействительна', 422)
    user.status = 'ACTIVE'
    token.used_at = datetime.now(timezone.utc)
    audit(db, user, 'Email подтверждён', str(user.id))
    db.commit()
    return {'message': 'Email подтверждён'}


@router.post('/auth/verify-email/resend', status_code=202)
def resend(body: EmailInput, request: Request, db: Db):
    public_command(request)
    user = db.scalar(select(User).where(User.email == email(body.email), User.status == 'PENDING'))
    if user:
        raw, token = issue(db, user.email, 'verify', user)
        deliver(user.email, 'Подтверждение email', '/verify-email?token=' + raw)
        db.commit()
    return {'message': 'Если аккаунт ожидает подтверждения, письмо отправлено'}


@router.post('/auth/login')
def login(body: Login, request: Request, response: Response, db: Db):
    public_command(request)
    name = body.email.strip().lower()
    user = db.scalar(select(User).where(or_(func.lower(User.email) == name, func.lower(User.username) == name)))
    if not user or not verify_password(body.password, user.password_hash):
        raise ApiError('INVALID_CREDENTIALS', 'Неверный email, логин или пароль', 401)
    if user.status != 'ACTIVE':
        raise ApiError('FORBIDDEN', 'Подтвердите email или обратитесь к администратору', 403)
    csrf = start_session(db, user, response)
    user.last_login_at = datetime.now(timezone.utc)
    audit(db, user, 'Вход', str(user.id))
    db.commit()
    return {'csrf_token': csrf}


@router.post('/auth/logout', status_code=204)
def logout(request: Request, response: Response, db: Db):
    check_csrf(request)
    from ..models import AuthSession
    raw = request.cookies.get(SESSION_COOKIE, '')
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == digest(raw))) if raw else None
    if session:
        session.revoked = True
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path='/')
    response.delete_cookie(CSRF_COOKIE, path='/')


@router.post('/auth/password/forgot', status_code=202)
def forgot(body: EmailInput, request: Request, db: Db):
    public_command(request)
    user = db.scalar(select(User).where(User.email == email(body.email), User.status == 'ACTIVE'))
    if user:
        raw, token = issue(db, user.email, 'reset', user)
        deliver(user.email, 'Восстановление пароля', '/reset-password?token=' + raw)
        db.commit()
    return {'message': 'Если аккаунт существует, инструкция отправлена'}


@router.post('/auth/password/reset')
def reset(body: Reset, request: Request, db: Db):
    public_command(request)
    password(body.password)
    token = token_of(db, body.token, 'reset')
    user = db.get(User, token.user_id)
    if not user or user.status != 'ACTIVE':
        raise ApiError('INVALID_TOKEN', 'Ссылка недействительна', 422)
    user.password_hash = hash_password(body.password)
    revoke_sessions(db, user)
    token.used_at = datetime.now(timezone.utc)
    audit(db, user, 'Пароль изменён', str(user.id))
    db.commit()
    return {'message': 'Пароль изменён'}


@router.patch('/auth/profile')
def profile(body: Profile, db: Db, user: Actor):
    if not body.name.strip():
        raise ApiError('VALIDATION_ERROR', 'Укажите имя', 422)
    user.display_name = body.name.strip()
    db.commit()
    return account(user)


@router.post('/auth/password/change')
def change_password(body: ChangePassword, db: Db, user: Actor):
    password(body.password)
    if not verify_password(body.current_password, user.password_hash):
        raise ApiError('VALIDATION_ERROR', 'Текущий пароль неверен', 422)
    user.password_hash = hash_password(body.password)
    revoke_sessions(db, user)
    audit(db, user, 'Пароль изменён', str(user.id))
    db.commit()
    return {'message': 'Пароль изменён. Войдите снова.'}


@router.get('/admin/staff')
def staff(db: Db, user: Actor):
    admin(user)
    return [account(u) for u in db.scalars(select(User).where(User.role.in_(('BANK_EMPLOYEE', 'BANK_OFFICER', 'BANK_ADMIN'))).order_by(User.created_at))]


@router.get('/admin/staff/invitations')
def invitations(db: Db, user: Actor):
    admin(user)
    return [{'id': str(t.id), 'email': t.email, 'role': 'BANK_OFFICER', 'expiresAt': aware(t.expires_at).isoformat(), 'createdAt': aware(t.created_at).isoformat(), 'status': 'REVOKED' if t.revoked else 'USED' if t.used_at else 'PENDING'} for t in db.scalars(select(IdentityToken).where(IdentityToken.kind == 'invitation').order_by(IdentityToken.created_at.desc()))]


@router.post('/admin/staff/invitations', status_code=201)
def invite(body: EmailInput, db: Db, user: Actor):
    admin(user)
    target = email(body.email)
    if db.scalar(select(User.id).where(User.email == target)):
        raise ApiError('CONFLICT', 'Аккаунт с таким email уже существует', 409)
    raw, token = issue(db, target, 'invitation', inviter=user)
    db.flush()
    deliver(target, 'Приглашение сотрудника', '/accept-invitation?token=' + raw)
    audit(db, user, 'Приглашение создано', str(token.id))
    db.commit()
    return {'id': str(token.id)}


@router.post('/admin/staff/invitations/{token_id}/revoke')
def revoke_invitation(token_id: uuid.UUID, db: Db, user: Actor):
    admin(user)
    token = db.get(IdentityToken, token_id, with_for_update=True)
    if not token or token.kind != 'invitation':
        raise ApiError('NOT_FOUND', 'Приглашение не найдено', 404)
    if token.used_at or token.revoked:
        raise ApiError('CONFLICT', 'Приглашение уже обработано', 409)
    token.revoked = True
    audit(db, user, 'Приглашение отозвано', str(token.id))
    db.commit()
    return {'message': 'Приглашение отозвано'}


@router.post('/auth/invitations/inspect')
def inspect_invitation(body: TokenInput, request: Request, db: Db):
    public_command(request)
    value = token_of(db, body.token, 'invitation')
    return {'email': value.email, 'expiresAt': aware(value.expires_at).isoformat()}


@router.post('/auth/invitations/accept')
def accept_invitation(body: AcceptInvitation, request: Request, db: Db):
    public_command(request)
    password(body.password)
    token = token_of(db, body.token, 'invitation')
    if not body.name.strip() or db.scalar(select(User.id).where(User.email == token.email)):
        raise ApiError('CONFLICT', 'Проверьте имя и адрес аккаунта', 409)
    user = User(username='u_' + uuid.uuid4().hex, email=token.email, display_name=body.name.strip(), password_hash=hash_password(body.password), role='BANK_OFFICER', status='ACTIVE')
    db.add(user)
    db.flush()
    token.user_id = user.id
    token.used_at = datetime.now(timezone.utc)
    audit(db, user, 'Приглашение принято', str(token.id))
    db.commit()
    return {'message': 'Аккаунт активирован'}


def set_staff_status(db: Session, actor: User, target: uuid.UUID, status: str):
    admin(actor)
    user = db.get(User, target, with_for_update=True)
    if not user or user.role not in ('BANK_EMPLOYEE', 'BANK_OFFICER'):
        raise ApiError('NOT_FOUND', 'Сотрудник не найден', 404)
    user.status = status
    revoke_sessions(db, user)
    audit(db, actor, 'Доступ заблокирован' if status == 'SUSPENDED' else 'Доступ восстановлен', str(user.id))
    db.commit()
    return {'message': 'Изменение сохранено'}


@router.post('/admin/staff/{user_id}/suspend')
def suspend(user_id: uuid.UUID, db: Db, user: Actor):
    return set_staff_status(db, user, user_id, 'SUSPENDED')


@router.post('/admin/staff/{user_id}/reactivate')
def reactivate(user_id: uuid.UUID, db: Db, user: Actor):
    return set_staff_status(db, user, user_id, 'ACTIVE')


@router.get('/admin/audit')
def audit_log(db: Db, user: Actor):
    admin(user)
    return [{'id': str(e.id), 'actor': str(e.actor_id or ''), 'action': e.action, 'object': e.object_id, 'createdAt': aware(e.created_at).isoformat()} for e in db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(1000))]
