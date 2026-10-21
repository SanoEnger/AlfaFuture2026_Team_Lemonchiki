"""Canonical database schema; apply structural changes through Alembic."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, Uuid, UniqueConstraint
from sqlalchemy import JSON, MetaData, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


JsonField = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        "pk": "pk_%(table_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ix": "ix_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
    })


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('CLIENT', 'BANK_EMPLOYEE')", name="role"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(24), nullable=False)


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("length(inn) IN (10, 12) AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(inn, '0', ''), '1', ''), '2', ''), '3', ''), '4', ''), '5', ''), '6', ''), '7', ''), '8', ''), '9', '') = ''", name="inn_format"),
        CheckConstraint("months_active >= 0 AND revenue >= 0 AND expenses >= 0 AND debt_payment >= 0", name="financials"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    inn: Mapped[str] = mapped_column(String(12), unique=True)
    legal_name: Mapped[str] = mapped_column(String(255))
    form: Mapped[str] = mapped_column(String(50))
    industry: Mapped[str] = mapped_column(String(100))
    months_active: Mapped[int] = mapped_column(Integer)
    revenue: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    expenses: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    debt_payment: Mapped[Decimal] = mapped_column(Numeric(16, 2))


class CreditProduct(Base):
    __tablename__ = "credit_products"
    __table_args__ = (
        CheckConstraint("min_amount > 0 AND max_amount >= min_amount", name="amount_range"),
        CheckConstraint("min_term > 0 AND max_term >= min_term", name="term_range"),
        CheckConstraint("annual_rate >= 0", name="rate"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    purpose: Mapped[str] = mapped_column(String(100))
    min_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    max_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    min_term: Mapped[int] = mapped_column(Integer)
    max_term: Mapped[int] = mapped_column(Integer)
    annual_rate: Mapped[Decimal] = mapped_column(Numeric(6, 2))


class LoanApplication(Base):
    __tablename__ = "loan_applications"
    __table_args__ = (
        CheckConstraint("version >= 1", name="version"),
        CheckConstraint("requested_amount > 0 AND term_months > 0", name="requested_terms"),
        CheckConstraint("status IN ('DRAFT', 'SUBMITTED', 'VERIFYING', 'NEEDS_INFO', 'UNDER_REVIEW', 'OFFERED', 'REJECTED', 'ACCEPTED', 'DECLINED', 'COMPLETED')", name="status"),
        Index("ix_loan_apps_applicant_created", "applicant_id", "created_at"),
        Index("ix_loan_apps_company_created", "company_id", "created_at"),
        Index("ix_loan_apps_status_updated", "status", "updated_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"))
    applicant_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("credit_products.id", ondelete="RESTRICT"), index=True)
    requested_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    term_months: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String(100))
    financial_snapshot: Mapped[dict | None] = mapped_column(JsonField, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", server_default="DRAFT")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now(), onupdate=utcnow)


class VerificationResult(Base):
    __tablename__ = "verification_results"
    __table_args__ = (
        UniqueConstraint("application_id", "attempt_no", "check_type"),
        CheckConstraint("attempt_no >= 1", name="attempt"),
        CheckConstraint("check_type IN ('REGISTRY', 'BKI')", name="check_type"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("loan_applications.id", ondelete="RESTRICT"))
    check_type: Mapped[str] = mapped_column(String(32))
    result: Mapped[dict] = mapped_column(JsonField)
    passed: Mapped[bool] = mapped_column(Boolean)
    attempt_no: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    __table_args__ = (
        UniqueConstraint("application_id", "attempt_no"),
        CheckConstraint("attempt_no >= 1", name="attempt"),
        CheckConstraint("score BETWEEN 0 AND 100", name="score"),
        CheckConstraint("risk_level IN ('LOW', 'MEDIUM', 'HIGH')", name="risk_level"),
        CheckConstraint("factors_schema_version >= 1", name="factors_schema_version"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("loan_applications.id", ondelete="RESTRICT"))
    score: Mapped[int] = mapped_column(Integer)
    risk_level: Mapped[str] = mapped_column(String(16))
    factors: Mapped[list] = mapped_column(JsonField)
    factors_schema_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    recommendation: Mapped[str] = mapped_column(Text)
    rules_version: Mapped[str] = mapped_column(String(40))
    input_snapshot: Mapped[dict] = mapped_column(JsonField)
    attempt_no: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class CreditDecision(Base):
    __tablename__ = "credit_decisions"
    __table_args__ = (
        CheckConstraint("type IN ('OFFERED', 'REJECTED')", name="type"),
        CheckConstraint("(type = 'OFFERED' AND offer_amount IS NOT NULL AND offer_amount > 0 AND offer_term IS NOT NULL AND offer_term > 0 AND offer_rate IS NOT NULL AND offer_rate >= 0) OR (type = 'REJECTED' AND offer_amount IS NULL AND offer_term IS NULL AND offer_rate IS NULL)", name="offer_terms"),
        CheckConstraint("length(trim(reason)) > 0", name="reason"),
        Index("ix_decisions_app_created", "application_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("loan_applications.id", ondelete="RESTRICT"))
    decided_by: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    offer_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2), nullable=True)
    offer_term: Mapped[int | None] = mapped_column(Integer, nullable=True)
    offer_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class InformationRequest(Base):
    __tablename__ = "information_requests"
    __table_args__ = (
        CheckConstraint("status IN ('OPEN', 'RESOLVED')", name="status"),
        CheckConstraint("(status = 'OPEN' AND resolved_at IS NULL) OR (status = 'RESOLVED' AND resolved_at IS NOT NULL AND resolved_at >= created_at)", name="resolution"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("loan_applications.id", ondelete="RESTRICT"), index=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", server_default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ApplicationDocument(Base):
    __tablename__ = "application_documents"
    __table_args__ = (
        CheckConstraint("size_bytes > 0 AND size_bytes <= 5242880", name="size"),
        CheckConstraint("mime_type = 'application/pdf'", name="mime_type"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("loan_applications.id", ondelete="RESTRICT"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class ApplicationEvent(Base):
    __tablename__ = "application_events"
    __table_args__ = (
        Index("ix_events_app_occurred", "application_id", "occurred_at"),
        CheckConstraint("to_status IN ('DRAFT', 'SUBMITTED', 'VERIFYING', 'NEEDS_INFO', 'UNDER_REVIEW', 'OFFERED', 'REJECTED', 'ACCEPTED', 'DECLINED', 'COMPLETED')", name="to_status"),
        CheckConstraint("from_status IS NULL OR from_status IN ('DRAFT', 'SUBMITTED', 'VERIFYING', 'NEEDS_INFO', 'UNDER_REVIEW', 'OFFERED', 'REJECTED', 'ACCEPTED', 'DECLINED', 'COMPLETED')", name="from_status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("loan_applications.id", ondelete="RESTRICT"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True)
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())


class NewsItem(Base):
    __tablename__ = "news_items"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    target_industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_purpose: Mapped[str | None] = mapped_column(String(100), nullable=True)
