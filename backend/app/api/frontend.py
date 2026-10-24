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
from ..schemas import CompanyResponse, DocumentResponse, InfoRequestResponse, ProductResponse, FinancialUpdate, CompanyDetailsUpdate, Status
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


class CompanyPatch(BaseModel):
    details: CompanyDetailsUpdate | None = None
    financials: FinancialUpdate | None = None
    industry: str | None = None


@router.get('/auth/me', response_model=CurrentUserResponse)
def me(db: Db, user: Authenticated):
    company = db.scalar(select(Company.id).where(Company.owner_user_id == user.id))
    return CurrentUserResponse(id=user.id, username=user.username, role=user.role, onboarding_complete=company is not None)


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
    transition(db, application, Status.COMPLETED, actor_id=user.id, reason='Клиент явно завершил демонстрационное оформление; средства не выдавались')
    db.commit()
    return status_response(application)
