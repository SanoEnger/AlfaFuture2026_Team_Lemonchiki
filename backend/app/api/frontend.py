"""Additive endpoints needed by the existing UI; no schema replacement."""
from __future__ import annotations

import uuid
from pathlib import Path
import os
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..errors import ApiError
from ..models import ApplicationDocument, Company, CreditProduct, InformationRequest, User
from ..schemas import CompanyResponse, DocumentResponse, InfoRequestResponse, ProductResponse, FinancialUpdate, CompanyDetailsUpdate, Status, StatusResponse
from pydantic import BaseModel
from .routes import Client, company_of, app_of, status_response
from ..services.workflow import transition

router = APIRouter(prefix='/api/v1', tags=['frontend-integration'])
Db = Annotated[Session, Depends(get_db)]
Authenticated = Annotated[User, Depends(current_user)]


class CurrentUserResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    onboarding_complete: bool
    email: str | None = None
    display_name: str = ''
    status: str = 'ACTIVE'


class CompanyPatch(BaseModel):
    details: CompanyDetailsUpdate | None = None
    financials: FinancialUpdate | None = None
    industry: str | None = None


class CreateCompany(FinancialUpdate):
    legal_name: str
    inn: str
    form: str
    industry: str


@router.post('/organizations', response_model=CompanyResponse, status_code=201)
def create_company(body: CreateCompany, db: Db, user: Client):
    import re
    if not body.legal_name.strip() or len(body.legal_name) > 255 or not re.fullmatch(r'(?:\d{10}|\d{12})', body.inn) or not body.form.strip() or len(body.form) > 50 or not body.industry.strip() or len(body.industry) > 100:
        raise ApiError('VALIDATION_ERROR', 'Проверьте реквизиты компании и ИНН', 422)
    db.get(User, user.id, with_for_update=True)
    if db.scalar(select(Company.id).where(Company.owner_user_id == user.id)):
        raise ApiError('CONFLICT', 'Компания уже настроена', 409)
    if db.scalar(select(Company.id).where(Company.inn == body.inn)):
        raise ApiError('CONFLICT', 'Компания с таким ИНН уже существует. Автоматическое присоединение недоступно.', 409)
    company = Company(owner_user_id=user.id, **body.model_dump())
    db.add(company)
    db.commit()
    return company


@router.get('/auth/me', response_model=CurrentUserResponse)
def me(db: Db, user: Authenticated):
    company = db.scalar(select(Company.id).where(Company.owner_user_id == user.id))
    return CurrentUserResponse(id=user.id, username=user.username, role=user.role, onboarding_complete=company is not None, email=user.email, display_name=user.display_name or user.username, status=user.status)


@router.get('/catalog', response_model=list[ProductResponse])
def catalog(db: Db, user: Authenticated):
    """Authenticated shared catalog, preserving the legacy CLIENT-only /products."""
    return db.scalars(select(CreditProduct).order_by(CreditProduct.code)).all()


@router.patch('/business/me', response_model=CompanyResponse)
def update_company(body: CompanyPatch, db: Db, user: Client):
    company = company_of(db, user)
    if body.details:
        if body.details.inn:
            other = db.scalar(select(Company.id).where(Company.inn == body.details.inn, Company.id != company.id))
            if other:
                raise ApiError('VALIDATION_ERROR', 'ИНН уже принадлежит другой компании', 422)
        for name in body.details.model_fields_set:
            setattr(company, name, getattr(body.details, name))
    if body.financials:
        for name in body.financials.model_fields_set:
            setattr(company, name, getattr(body.financials, name))
    if body.industry is not None:
        if not body.industry.strip() or len(body.industry) > 100:
            raise ApiError('VALIDATION_ERROR', 'Проверьте отрасль', 422)
        company.industry = body.industry.strip()
    db.commit()
    return company


@router.get('/applications/{application_id}/documents', response_model=list[DocumentResponse])
def documents(application_id: uuid.UUID, db: Db, user: Client):
    app_of(db, application_id, user)
    return db.scalars(select(ApplicationDocument).where(ApplicationDocument.application_id == application_id).order_by(ApplicationDocument.created_at)).all()


@router.get('/applications/{application_id}/information-requests', response_model=list[InfoRequestResponse])
def requests(application_id: uuid.UUID, db: Db, user: Client):
    app_of(db, application_id, user)
    return db.scalars(select(InformationRequest).where(InformationRequest.application_id == application_id).order_by(InformationRequest.created_at)).all()


@router.get('/applications/{application_id}/documents/{document_id}/download')
def download(application_id: uuid.UUID, document_id: uuid.UUID, db: Db, user: Client):
    app_of(db, application_id, user)
    document = db.scalar(select(ApplicationDocument).where(ApplicationDocument.id == document_id, ApplicationDocument.application_id == application_id))
    if document is None or Path(document.storage_key).name != document.storage_key:
        raise ApiError('NOT_FOUND', 'Документ не найден', 404)
    location = Path(os.getenv('UPLOAD_DIR', './storage')) / document.storage_key
    if not location.is_file():
        raise ApiError('NOT_FOUND', 'Файл документа отсутствует', 404)
    return FileResponse(location, media_type='application/pdf', filename=document.file_name)


@router.post('/applications/{application_id}/complete')
def complete(application_id: uuid.UUID, db: Db, user: Client):
    application = app_of(db, application_id, user, lock=True)
    if application.status != Status.ACCEPTED:
        raise ApiError('INVALID_TRANSITION', 'Сначала примите предложение', 409)
    transition(db, application, Status.COMPLETED, actor_id=user.id, reason='Клиент завершил оформление заявки')
    db.commit()
    return status_response(application)


class Assignment(BaseModel):
    officer_id: uuid.UUID | None = None
    expected_version: int | None = None


@router.get('/bank/officers')
def officers(db: Db, user: Authenticated):
    if user.role not in ('BANK_EMPLOYEE', 'BANK_OFFICER', 'BANK_ADMIN'):
        raise ApiError('FORBIDDEN', 'Недостаточно прав', 403)
    return [{'id': str(u.id), 'displayName': u.display_name or u.username, 'status': u.status, 'role': u.role} for u in db.scalars(select(User).where(User.role.in_(('BANK_EMPLOYEE', 'BANK_OFFICER'))))]


@router.post('/bank/applications/{application_id}/claim', response_model=StatusResponse)
def claim(application_id: uuid.UUID, db: Db, user: Authenticated, body: Assignment = Assignment()):
    if user.role not in ('BANK_EMPLOYEE', 'BANK_OFFICER'):
        raise ApiError('FORBIDDEN', 'Требуются права сотрудника', 403)
    app = app_of(db, application_id, lock=True)
    if app.status != 'UNDER_REVIEW' or app.assigned_officer_id or (body.expected_version is not None and app.revision != body.expected_version):
        raise ApiError('CONFLICT', 'Заявка уже назначена или изменилась', 409)
    app.assigned_officer_id = user.id
    app.revision += 1
    from ..services.workflow import append_event
    append_event(db, app, app.status, app.status, 'Заявка взята в работу: ' + (user.display_name or user.username), user.id)
    db.commit()
    return status_response(app)


@router.post('/bank/applications/{application_id}/assign', response_model=StatusResponse)
def assign(application_id: uuid.UUID, body: Assignment, db: Db, user: Authenticated):
    if user.role != 'BANK_ADMIN':
        raise ApiError('FORBIDDEN', 'Требуются права администратора', 403)
    app = app_of(db, application_id, lock=True)
    if body.expected_version is not None and app.revision != body.expected_version:
        raise ApiError('CONFLICT', 'Заявка изменилась', 409)
    officer = db.get(User, body.officer_id) if body.officer_id else None
    if not officer or officer.status != 'ACTIVE' or officer.role not in ('BANK_EMPLOYEE', 'BANK_OFFICER'):
        raise ApiError('VALIDATION_ERROR', 'Выберите активного сотрудника', 422)
    previous = str(app.assigned_officer_id or '')
    app.assigned_officer_id = officer.id
    app.revision += 1
    from ..security import audit
    from ..services.workflow import append_event
    audit(db, user, 'Ответственный изменён', str(app.id), previous + ' -> ' + str(officer.id))
    append_event(db, app, app.status, app.status, 'Ответственный: ' + (officer.display_name or officer.username), user.id)
    db.commit()
    return status_response(app)
