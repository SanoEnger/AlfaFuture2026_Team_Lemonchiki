"""REST routes. No DDL or actual banking service calls here."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import or_, select
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import issue_token, require_role, verify_password
from ..db import get_db
from ..errors import ApiError
from ..models import (
    ApplicationDocument, ApplicationEvent, Company, CreditDecision, CreditProduct,
    InformationRequest, LoanApplication, NewsItem, RiskAssessment, User, VerificationResult,
)
from ..schemas import (
    ApplicationResponse, BankApplicationResponse, BankDecisionRequest, CompanyResponse,
    CreateApplicationRequest, DemoLoginRequest, DocumentResponse, EventResponse,
    InfoRequestInput, InfoRequestResponse, NewsResponse, OfferResponse, PatchApplicationRequest,
    ProductResponse, ResubmitRequest, RiskAssessmentResponse, Status, StatusResponse,
    SubmitResponse, TermsResponse, TokenResponse, VerificationResponse, ErrorResponse,
)
from ..services.checks import run_checks
from ..services.workflow import append_event, next_action, transition

router = APIRouter(prefix='/api/v1', responses={
    401: {'model': ErrorResponse}, 403: {'model': ErrorResponse},
    404: {'model': ErrorResponse}, 409: {'model': ErrorResponse},
    422: {'model': ErrorResponse},
})
Db = Annotated[Session, Depends(get_db)]
Client = Annotated[User, Depends(require_role('CLIENT'))]
Banker = Annotated[User, Depends(require_role('BANK_EMPLOYEE'))]


def company_of(db: Session, user: User) -> Company:
    company = db.scalar(select(Company).where(Company.owner_user_id == user.id))
    if not company:
        raise ApiError('NOT_FOUND', 'Компания для пользователя не найдена', 404)
    return company


def app_of(db: Session, app_id: uuid.UUID, user: User | None = None, lock: bool = False) -> LoanApplication:
    stmt = select(LoanApplication).where(LoanApplication.id == app_id)
    if user is not None:
        # 404 for other users prevents leaking existence of applications.
        stmt = stmt.where(LoanApplication.applicant_id == user.id)
    if lock:
        stmt = stmt.with_for_update()
    app = db.scalar(stmt)
    if not app:
        raise ApiError('NOT_FOUND', 'Заявка не найдена', 404)
    return app


def validate_product(db: Session, product_id: uuid.UUID, amount: Decimal, term_months: int) -> CreditProduct:
    product = db.get(CreditProduct, product_id)
    if not product:
        raise ApiError('VALIDATION_ERROR', 'Кредитный продукт не найден', 422)
    if not (product.min_amount <= amount <= product.max_amount):
        raise ApiError('VALIDATION_ERROR', f'Сумма должна быть от {product.min_amount} до {product.max_amount}', 422)
    if not (product.min_term <= term_months <= product.max_term):
        raise ApiError('VALIDATION_ERROR', f'Срок должен быть от {product.min_term} до {product.max_term} месяцев', 422)
    return product


def update_financials(company: Company, financials) -> None:
    if financials is None:
        return
    company.revenue = financials.revenue
    company.expenses = financials.expenses
    company.debt_payment = financials.debt_payment
    company.months_active = financials.months_active


def latest_decision(db: Session, app_id: uuid.UUID) -> CreditDecision | None:
    return db.scalar(select(CreditDecision).where(CreditDecision.application_id == app_id).order_by(CreditDecision.created_at.desc(), CreditDecision.id.desc()).limit(1))


def as_application(db: Session, app: LoanApplication) -> ApplicationResponse:
    company = db.get(Company, app.company_id)
    decision = latest_decision(db, app.id)
    offer = None
    if decision and decision.type == 'OFFERED':
        offer = OfferResponse(amount=decision.offer_amount, term_months=decision.offer_term, annual_rate=decision.offer_rate, reason=decision.reason, created_at=decision.created_at)
    return ApplicationResponse(id=app.id, status=app.status, requested_terms=TermsResponse(amount=app.requested_amount, term_months=app.term_months, product_id=app.product_id, purpose=app.purpose), company=CompanyResponse.model_validate(company), updated_at=app.updated_at, next_action=next_action(app.status), latest_offer=offer)


def status_response(app: LoanApplication) -> StatusResponse:
    return StatusResponse(application_id=app.id, current_status=app.status, next_action=next_action(app.status))


@router.post('/auth/demo-login', response_model=TokenResponse, tags=['auth'])
def demo_login(body: DemoLoginRequest, db: Db):
    user = db.scalar(select(User).where(User.username == body.username))
    if not user or not verify_password(body.password, user.password_hash):
        raise ApiError('UNAUTHORIZED', 'Неверный логин или пароль', 401)
    return TokenResponse(access_token=issue_token(user), role=user.role)


@router.get('/products', response_model=list[ProductResponse], tags=['client'])
def products(db: Db, user: Client):
    return db.scalars(select(CreditProduct).order_by(CreditProduct.code)).all()


@router.get('/business/me', response_model=CompanyResponse, tags=['client'])
def business_me(db: Db, user: Client):
    return company_of(db, user)


@router.get('/news', response_model=list[NewsResponse], tags=['client'])
def news(db: Db, user: Client):
    company = company_of(db, user)
    latest_app = db.scalar(select(LoanApplication).where(LoanApplication.company_id == company.id).order_by(LoanApplication.created_at.desc(), LoanApplication.id.desc()).limit(1))
    stmt = select(NewsItem).where(or_(NewsItem.target_industry == company.industry, NewsItem.target_purpose == (latest_app.purpose if latest_app else ''), NewsItem.target_industry.is_(None) & NewsItem.target_purpose.is_(None)))
    return db.scalars(stmt.order_by(NewsItem.title)).all()


@router.get('/applications', response_model=list[ApplicationResponse], tags=['client'])
def list_apps(db: Db, user: Client):
    apps = db.scalars(select(LoanApplication).where(LoanApplication.applicant_id == user.id).order_by(LoanApplication.created_at.desc())).all()
    return [as_application(db, a) for a in apps]


@router.post('/applications', response_model=ApplicationResponse, status_code=201, tags=['client'])
def create_app(body: CreateApplicationRequest, db: Db, user: Client):
    product = validate_product(db, body.product_id, body.amount, body.term_months)
    company = company_of(db, user)
    if not (len(company.inn) in (10, 12) and company.inn.isascii() and company.inn.isdecimal()):
        raise ApiError('VALIDATION_ERROR', 'ИНН должен состоять из 10 или 12 цифр', 422)
    update_financials(company, body.company_financials)
    application = LoanApplication(company_id=company.id, applicant_id=user.id, product_id=product.id, requested_amount=body.amount, term_months=body.term_months, purpose=body.purpose, status=Status.DRAFT)
    db.add(application)
    db.flush()
    append_event(db, application, None, Status.DRAFT, 'Клиент создал черновик', user.id)
    db.commit()
    return as_application(db, application)


@router.patch('/applications/{application_id}', response_model=ApplicationResponse, tags=['client'])
def patch_app(application_id: uuid.UUID, body: PatchApplicationRequest, db: Db, user: Client):
    app = app_of(db, application_id, user, lock=True)
    if app.status != Status.DRAFT:
        raise ApiError('INVALID_TRANSITION', 'Изменять можно только черновик', 409)
    product_id = body.product_id or app.product_id
    amount = body.amount if body.amount is not None else app.requested_amount
    term = body.term_months if body.term_months is not None else app.term_months
    validate_product(db, product_id, amount, term)
    app.product_id, app.requested_amount, app.term_months = product_id, amount, term
    if body.purpose is not None:
        app.purpose = body.purpose
    update_financials(db.get(Company, app.company_id), body.company_financials)
    app.updated_at = datetime.now(timezone.utc)
    db.commit()
    return as_application(db, app)


@router.get('/applications/{application_id}', response_model=ApplicationResponse, tags=['client'])
def get_app(application_id: uuid.UUID, db: Db, user: Client):
    return as_application(db, app_of(db, application_id, user))


@router.post('/applications/{application_id}/submit', response_model=SubmitResponse, tags=['client'])
def submit_app(application_id: uuid.UUID, db: Db, user: Client):
    app = app_of(db, application_id, user, lock=True)
    if app.status != Status.DRAFT:
        raise ApiError('DUPLICATE_OPERATION', 'Эта заявка уже отправлена', 409)
    company = db.get(Company, app.company_id)
    product = validate_product(db, app.product_id, app.requested_amount, app.term_months)
    transition(db, app, Status.SUBMITTED, actor_id=user.id, reason='Клиент отправил заявку')
    checks_status = run_checks(db, app, company, product)
    db.commit()
    return SubmitResponse(application_id=app.id, current_status=app.status, checks_status=checks_status)


@router.post('/applications/{application_id}/documents', response_model=DocumentResponse, status_code=201, tags=['client'])
async def upload_document(application_id: uuid.UUID, db: Db, user: Client, file: UploadFile = File(...)):
    app = app_of(db, application_id, user, lock=True)
    if app.status not in (Status.DRAFT, Status.NEEDS_INFO):
        raise ApiError('INVALID_TRANSITION', 'Загружать документы можно в черновик или при уточнении', 409)
    safe_name = Path(file.filename or '').name
    if not safe_name.lower().endswith('.pdf'):
        raise ApiError('VALIDATION_ERROR', 'Разрешены только PDF', 422)
    folder = Path(os.getenv('UPLOAD_DIR', './storage'))
    folder.mkdir(parents=True, exist_ok=True)
    storage_id = f'{uuid.uuid4().hex}.pdf'
    dest = folder / storage_id
    size = 0
    try:
        with dest.open('wb') as out:
            first = await file.read(5)
            if first != b'%PDF-':
                raise ApiError('VALIDATION_ERROR', 'Файл не похож на PDF', 422)
            out.write(first)
            size = len(first)
            while piece := await file.read(64 * 1024):
                size += len(piece)
                if size > 5 * 1024 * 1024:
                    raise ApiError('VALIDATION_ERROR', 'Максимальный размер PDF 5 МБ', 422)
                out.write(piece)
        record = ApplicationDocument(application_id=app.id, file_name=safe_name[:255], mime_type='application/pdf', size_bytes=size, storage_key=storage_id)
        db.add(record)
        append_event(db, app, app.status, app.status, f'Загружен PDF: {safe_name[:255]}', user.id)
        db.commit()
        return record
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@router.post('/applications/{application_id}/resubmit', response_model=SubmitResponse, tags=['client'])
def resubmit_app(application_id: uuid.UUID, body: ResubmitRequest, db: Db, user: Client):
    app = app_of(db, application_id, user, lock=True)
    if app.status != Status.NEEDS_INFO:
        raise ApiError('INVALID_TRANSITION', 'Повторная отправка возможна только в NEEDS_INFO', 409)
    open_requests = db.scalars(select(InformationRequest).where(InformationRequest.application_id == app.id, InformationRequest.status == 'OPEN')).all()
    if not open_requests:
        raise ApiError('INVALID_TRANSITION', 'Для заявки нет открытого запроса уточнений', 409)
    company = db.get(Company, app.company_id)
    recent_documents = db.scalars(select(ApplicationDocument).where(
        ApplicationDocument.application_id == app.id,
        ApplicationDocument.created_at >= min(request.created_at for request in open_requests),
    )).first()
    if body.company_financials is None and body.company_details is None and not body.response_message and not recent_documents:
        raise ApiError('VALIDATION_ERROR', 'Требуется ответ, документ или уточнение данных', 422)
    if body.company_details is not None:
        for name in body.company_details.model_fields_set:
            setattr(company, name, getattr(body.company_details, name))
        if body.company_details.inn is not None:
            duplicate = db.scalar(select(Company).where(Company.inn == body.company_details.inn, Company.id != company.id))
            if duplicate:
                raise ApiError('VALIDATION_ERROR', 'ИНН уже принадлежит другой компании', 422)
    update_financials(company, body.company_financials)
    for info in open_requests:
        info.status = 'RESOLVED'
        info.resolved_at = datetime.now(timezone.utc)
    app.version += 1
    transition(db, app, Status.SUBMITTED, actor_id=user.id, reason='Клиент предоставил уточнения: ' + (body.response_message or 'повторная отправка'))
    status = run_checks(db, app, db.get(Company, app.company_id), db.get(CreditProduct, app.product_id))
    db.commit()
    return SubmitResponse(application_id=app.id, current_status=app.status, checks_status=status)


@router.get('/applications/{application_id}/history', response_model=list[EventResponse], tags=['client'])
def app_history(application_id: uuid.UUID, db: Db, user: Client):
    app_of(db, application_id, user)
    return db.scalars(select(ApplicationEvent).where(ApplicationEvent.application_id == application_id).order_by(ApplicationEvent.occurred_at, ApplicationEvent.id)).all()


@router.post('/applications/{application_id}/accept', response_model=StatusResponse, tags=['client'])
def accept_offer(application_id: uuid.UUID, db: Db, user: Client):
    app = app_of(db, application_id, user, lock=True)
    if app.status != Status.OFFERED:
        raise ApiError('INVALID_TRANSITION', 'Нет доступного предложения', 409)
    decision = latest_decision(db, app.id)
    if not decision or decision.type != 'OFFERED':
        raise ApiError('INVALID_TRANSITION', 'Предложение банка не найдено', 409)
    transition(db, app, Status.ACCEPTED, actor_id=user.id, reason='Клиент принял предложение')
    transition(db, app, Status.COMPLETED, reason='Демонстрационная выдача завершена; реальные средства не перечислялись')
    db.commit()
    return status_response(app)


@router.post('/applications/{application_id}/decline', response_model=StatusResponse, tags=['client'])
def decline_offer(application_id: uuid.UUID, db: Db, user: Client):
    app = app_of(db, application_id, user, lock=True)
    if app.status != Status.OFFERED:
        raise ApiError('INVALID_TRANSITION', 'Нет доступного предложения', 409)
    transition(db, app, Status.DECLINED, actor_id=user.id, reason='Клиент отклонил предложение')
    db.commit()
    return status_response(app)


@router.get('/bank/applications', response_model=list[ApplicationResponse], tags=['bank'])
def bank_queue(db: Db, user: Banker, status: Status | None = Query(default=None)):
    stmt = select(LoanApplication)
    if status:
        stmt = stmt.where(LoanApplication.status == status)
    return [as_application(db, app) for app in db.scalars(stmt.order_by(LoanApplication.updated_at.desc())).all()]


@router.get('/bank/applications/{application_id}', response_model=BankApplicationResponse, tags=['bank'])
def bank_app(application_id: uuid.UUID, db: Db, user: Banker):
    app = app_of(db, application_id)
    risk = db.scalar(select(RiskAssessment).where(RiskAssessment.application_id == app.id).order_by(RiskAssessment.attempt_no.desc(), RiskAssessment.created_at.desc()).limit(1))
    checks = db.scalars(select(VerificationResult).where(VerificationResult.application_id == app.id).order_by(VerificationResult.attempt_no, VerificationResult.created_at)).all()
    requests = db.scalars(select(InformationRequest).where(InformationRequest.application_id == app.id).order_by(InformationRequest.created_at)).all()
    events = db.scalars(select(ApplicationEvent).where(ApplicationEvent.application_id == app.id).order_by(ApplicationEvent.occurred_at, ApplicationEvent.id)).all()
    documents = db.scalars(select(ApplicationDocument).where(ApplicationDocument.application_id == app.id).order_by(ApplicationDocument.created_at)).all()
    return BankApplicationResponse(application=as_application(db, app), risk=RiskAssessmentResponse.model_validate(risk) if risk else None, verifications=[VerificationResponse.model_validate(x) for x in checks], information_requests=[InfoRequestResponse.model_validate(x) for x in requests], events=[EventResponse.model_validate(x) for x in events], documents=[DocumentResponse.model_validate(x) for x in documents])


@router.post('/bank/applications/{application_id}/request-info', response_model=StatusResponse, tags=['bank'])
def request_info(application_id: uuid.UUID, body: InfoRequestInput, db: Db, user: Banker):
    app = app_of(db, application_id, lock=True)
    if app.status != Status.UNDER_REVIEW:
        raise ApiError('INVALID_TRANSITION', 'Запрос сведений доступен только при рассмотрении', 409)
    db.add(InformationRequest(application_id=app.id, message=body.message, status='OPEN'))
    transition(db, app, Status.NEEDS_INFO, actor_id=user.id, reason=body.message)
    db.commit()
    return status_response(app)


@router.post('/bank/applications/{application_id}/decision', response_model=StatusResponse, tags=['bank'])
def bank_decision(application_id: uuid.UUID, body: BankDecisionRequest, db: Db, user: Banker):
    app = app_of(db, application_id, lock=True)
    if app.status != Status.UNDER_REVIEW:
        raise ApiError('DUPLICATE_OPERATION', 'Решение доступно только при статусе UNDER_REVIEW', 409)
    assessment = db.scalar(select(RiskAssessment).where(RiskAssessment.application_id == app.id, RiskAssessment.attempt_no == app.version).order_by(RiskAssessment.created_at.desc()).limit(1))
    if assessment is None:
        raise ApiError('INVALID_TRANSITION', 'Нет действующей оценки риска', 409)
    checks = db.scalars(select(VerificationResult).where(VerificationResult.application_id == app.id, VerificationResult.attempt_no == app.version)).all()
    if len({item.check_type for item in checks if item.passed}) < 2:
        raise ApiError('INVALID_TRANSITION', 'Не завершены все проверки', 409)
    if body.type == 'OFFERED':
        product = db.get(CreditProduct, app.product_id)
        if not (product.min_amount <= body.offered_amount <= product.max_amount and body.offered_amount <= app.requested_amount):
            raise ApiError('VALIDATION_ERROR', 'Некорректная предлагаемая сумма', 422)
        if not product.min_term <= body.offered_term_months <= product.max_term:
            raise ApiError('VALIDATION_ERROR', 'Некорректный предлагаемый срок', 422)
    decision = CreditDecision(application_id=app.id, decided_by=user.id, type=body.type, offer_amount=body.offered_amount, offer_term=body.offered_term_months, offer_rate=body.offered_annual_rate, reason=body.reason)
    db.add(decision)
    transition(db, app, Status(body.type), actor_id=user.id, reason=body.reason)
    db.commit()
    return status_response(app)


@router.get('/bank/applications/{application_id}/documents/{document_id}', tags=['bank'])
def bank_download_document(application_id: uuid.UUID, document_id: uuid.UUID, db: Db, user: Banker):
    app_of(db, application_id)
    document = db.scalar(select(ApplicationDocument).where(ApplicationDocument.id == document_id, ApplicationDocument.application_id == application_id))
    if document is None:
        raise ApiError('NOT_FOUND', 'Документ не найден', 404)
    # Storage keys are generated server-side and may never be an arbitrary path.
    if Path(document.storage_key).name != document.storage_key:
        raise ApiError('NOT_FOUND', 'Документ не найден', 404)
    location = Path(os.getenv('UPLOAD_DIR', './storage')) / document.storage_key
    if not location.is_file():
        raise ApiError('NOT_FOUND', 'Файл документа отсутствует в хранилище', 404)
    return FileResponse(location, media_type='application/pdf', filename=document.file_name)
