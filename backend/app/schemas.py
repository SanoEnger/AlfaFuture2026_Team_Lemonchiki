from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Annotated
from uuid import UUID
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


Money = Decimal


def utc_timestamp(value: datetime) -> datetime:
    """Normalize even SQLite's timezone-naive test timestamps to UTC ISO 8601."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UTCTimestamp = Annotated[datetime, AfterValidator(utc_timestamp)]


class Status(str, Enum):
    DRAFT = 'DRAFT'
    SUBMITTED = 'SUBMITTED'
    VERIFYING = 'VERIFYING'
    NEEDS_INFO = 'NEEDS_INFO'
    UNDER_REVIEW = 'UNDER_REVIEW'
    OFFERED = 'OFFERED'
    REJECTED = 'REJECTED'
    ACCEPTED = 'ACCEPTED'
    DECLINED = 'DECLINED'
    COMPLETED = 'COMPLETED'


class DemoLoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    role: str


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: object | None = None


class FinancialUpdate(BaseModel):
    revenue: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    expenses: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    debt_payment: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    months_active: int = Field(ge=0, le=1200)


class CreateApplicationRequest(BaseModel):
    product_id: UUID
    amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    term_months: int = Field(gt=0, le=600)
    purpose: str = Field(min_length=1, max_length=100)
    comment: str = Field(default="", max_length=3000)
    company_financials: FinancialUpdate | None = None


class PatchApplicationRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=3000)
    expected_version: int | None = Field(default=None, ge=1)
    product_id: UUID | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    term_months: int | None = Field(default=None, gt=0, le=600)
    purpose: str | None = Field(default=None, min_length=1, max_length=100)
    company_financials: FinancialUpdate | None = None

    @model_validator(mode='after')
    def at_least_one(self):
        if not self.model_fields_set:
            raise ValueError('Не указаны изменяемые поля')
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError('Переданные поля не могут быть null')
        return self


class CompanyDetailsUpdate(BaseModel):
    legal_name: str | None = Field(default=None, min_length=1, max_length=255)
    inn: str | None = Field(default=None, pattern=r'^([0-9]{10}|[0-9]{12})$')
    form: str | None = Field(default=None, min_length=1, max_length=50)

    @model_validator(mode='after')
    def cannot_be_empty(self):
        if not self.model_fields_set:
            raise ValueError('Нет полей компании для уточнения')
        if any(getattr(self, name) is None for name in self.model_fields_set):
            raise ValueError('Переданные поля не могут быть null')
        return self


class ResubmitRequest(BaseModel):
    company_financials: FinancialUpdate | None = None
    company_details: CompanyDetailsUpdate | None = None
    response_message: str | None = Field(default=None, min_length=1, max_length=3000)


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    purpose: str
    min_amount: Decimal
    max_amount: Decimal
    min_term: int
    max_term: int
    annual_rate: Decimal


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    inn: str
    legal_name: str
    form: str
    industry: str
    months_active: int
    revenue: Decimal
    expenses: Decimal
    debt_payment: Decimal


class TermsResponse(BaseModel):
    comment: str = ""
    amount: Decimal
    term_months: int
    purpose: str
    product_id: UUID


class OfferResponse(BaseModel):
    amount: Decimal
    term_months: int
    annual_rate: Decimal
    reason: str
    created_at: UTCTimestamp


class ApplicationResponse(BaseModel):
    id: UUID
    status: Status
    requested_terms: TermsResponse
    company: CompanyResponse
    updated_at: UTCTimestamp
    next_action: str
    latest_offer: OfferResponse | None = None
    version: int = 1
    assigned_officer_id: UUID | None = None
    assigned_officer_name: str | None = None


class SubmitResponse(BaseModel):
    application_id: UUID
    current_status: Status
    checks_status: str


class StatusResponse(BaseModel):
    application_id: UUID
    current_status: Status
    next_action: str


class BankDecisionRequest(BaseModel):
    expected_version: int | None = Field(default=None, ge=1)
    type: str
    offered_amount: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    offered_term_months: int | None = Field(default=None, gt=0, le=600)
    offered_annual_rate: Decimal | None = Field(default=None, ge=0, le=100, max_digits=6, decimal_places=2)
    reason: str = Field(min_length=1, max_length=3000)

    @model_validator(mode='after')
    def offer_required(self):
        if self.type not in ('OFFERED', 'REJECTED'):
            raise ValueError('type должен быть OFFERED или REJECTED')
        if self.type == 'OFFERED' and (self.offered_amount is None or self.offered_term_months is None or self.offered_annual_rate is None):
            raise ValueError('Для OFFERED необходимо указать сумму, срок и ставку')
        if self.type == 'REJECTED' and any(x is not None for x in (self.offered_amount, self.offered_term_months, self.offered_annual_rate)):
            raise ValueError('При REJECTED параметры оффера не допускаются')
        return self


class InfoRequestInput(BaseModel):
    expected_version: int | None = Field(default=None, ge=1)
    message: str = Field(min_length=1, max_length=3000)


class InfoRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    message: str
    status: str
    created_at: UTCTimestamp
    resolved_at: UTCTimestamp | None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    actor_id: UUID | None
    from_status: str | None
    to_status: str
    reason: str
    occurred_at: UTCTimestamp


class VerificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    check_type: str
    result: dict
    passed: bool
    attempt_no: int
    created_at: UTCTimestamp


class RiskAssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    score: int
    risk_level: str
    factors: list
    recommendation: str
    rules_version: str
    attempt_no: int
    created_at: UTCTimestamp


class BankApplicationResponse(BaseModel):
    application: ApplicationResponse
    risk: RiskAssessmentResponse | None
    verifications: list[VerificationResponse]
    information_requests: list[InfoRequestResponse]
    events: list[EventResponse]
    documents: list[DocumentResponse]


class NewsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    body: str
    target_industry: str | None
    target_purpose: str | None


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    created_at: UTCTimestamp
