"""Repeatable synthetic seed. Migrations must be applied first."""
import argparse
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Company, CreditProduct, LoanApplication, NewsItem, RiskAssessment, User, VerificationResult
from .services import risk_port
from .services.checks import take_snapshot
from .services.workflow import append_event, transition


def demo_id(key: str):
    return uuid5(NAMESPACE_URL, f"alfa-smart-credit/demo/{key}")


def ensure(db, model, key, value, **fields):
    record = db.scalar(select(model).where(getattr(model, key) == value))
    if record is None:
        record = model(**{key: value}, **fields)
        db.add(record)
        db.flush()
    return record


def _seed(db: Session, include_scenarios: bool):
    users = {}
    for username, role in (("client_good", "CLIENT"), ("client_risky", "CLIENT"), ("banker", "BANK_EMPLOYEE")):
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(id=demo_id(username), username=username,
                        password_hash=hash_password("Demo2026!"), role=role)
            db.add(user)
            db.flush()
        users[username] = user
    good = ensure(db, Company, "owner_user_id", users["client_good"].id,
                  id=demo_id("company-good"), inn="7701234567", legal_name="ООО Демо-Пекарня",
                  form="ООО", industry="FOOD", months_active=48, revenue=Decimal("1400000"),
                  expenses=Decimal("650000"), debt_payment=Decimal("50000"))
    risky = ensure(db, Company, "owner_user_id", users["client_risky"].id,
                   id=demo_id("company-risky"), inn="7701234599", legal_name="ИП Демо-Сервис",
                   form="ИП", industry="SERVICES", months_active=3, revenue=Decimal("180000"),
                   expenses=Decimal("175000"), debt_payment=Decimal("40000"))
    working = ensure(db, CreditProduct, "code", "WORKING_CAPITAL", id=demo_id("working-capital"),
                     name="Оборотный", purpose="WORKING_CAPITAL", min_amount=Decimal("50000"),
                     max_amount=Decimal("5000000"), min_term=3, max_term=36, annual_rate=Decimal("18.00"))
    ensure(db, CreditProduct, "code", "INVESTMENT", id=demo_id("investment"),
           name="Инвестиционный", purpose="INVESTMENT", min_amount=Decimal("100000"),
           max_amount=Decimal("15000000"), min_term=6, max_term=84, annual_rate=Decimal("17.50"))
    for key, title, industry, purpose in (
        ("news-food", "Оборотный капитал для пищевого бизнеса", "FOOD", None),
        ("news-services", "Управление затратами в сервисе", "SERVICES", None),
        ("news-common", "Финансовое планирование МСП", None, None),
        ("news-investment", "Планирование инвестиций в оборудование", None, "INVESTMENT"),
    ):
        ensure(db, NewsItem, "id", demo_id(key), title=title,
               body="Синтетическая публикация для демонстрации. Не является рекомендацией банка.",
               target_industry=industry, target_purpose=purpose)
    if include_scenarios:
        _scenarios(db, users, good, risky, working)


def _scenarios(db, users, good, risky, product):
    for label, company, owner, finances in (
        ("LOW", good, users["client_good"], (48, "1400000", "650000", "50000")),
        ("MEDIUM", good, users["client_good"], (18, "300000", "240000", "20000")),
        ("HIGH", risky, users["client_risky"], (3, "180000", "175000", "40000")),
    ):
        app_id = demo_id(f"scenario-{label}")
        if db.get(LoanApplication, app_id) is not None:
            continue
        app = LoanApplication(id=app_id, company_id=company.id, applicant_id=owner.id,
                              product_id=product.id, requested_amount=Decimal("400000"),
                              term_months=12, purpose="WORKING_CAPITAL", status="DRAFT")
        db.add(app)
        db.flush()
        append_event(db, app, None, "DRAFT", f"Демо-сценарий {label}", owner.id)
        transition(db, app, "SUBMITTED", actor_id=owner.id, reason="Демо-подача")
        transition(db, app, "VERIFYING", reason="Демо-проверки")
        months, revenue, expenses, debt = finances
        # An historical snapshot must not overwrite the current company profile.
        profile = Company(inn=company.inn, industry=company.industry, months_active=months,
                          revenue=Decimal(revenue), expenses=Decimal(expenses), debt_payment=Decimal(debt))
        snapshot = take_snapshot(profile, app)
        app.financial_snapshot = snapshot
        registry = risk_port.registry_service.check(company.inn, company.legal_name)
        bki = risk_port.bki_service.check(company.inn)
        for kind, result in (("REGISTRY", registry), ("BKI", bki)):
            db.add(VerificationResult(application_id=app.id, check_type=kind,
                                      result={"schema_version": 1, **result},
                                      passed=bool(result.get("passed")), attempt_no=1))
        score = risk_port.scoring_service.evaluate(snapshot, registry, bki, {
            "amount": str(app.requested_amount), "term_months": app.term_months,
            "annual_rate": str(product.annual_rate),
        })
        db.add(RiskAssessment(application_id=app.id, input_snapshot=snapshot, attempt_no=1, **score))
        transition(db, app, "UNDER_REVIEW", reason="Демо-скоринг завершён")


def seed(db: Session | None = None, *, include_scenarios: bool = False):
    """Caller-owned sessions are not committed. CLI uses one atomic transaction."""
    if db is not None:
        _seed(db, include_scenarios)
        return
    from .db import SessionLocal
    with SessionLocal.begin() as session:
        _seed(session, include_scenarios)
    print("Demo data ready: client_good, client_risky, banker / Demo2026!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenarios", action="store_true", help="Create three historical scoring scenarios")
    seed(include_scenarios=parser.parse_args().scenarios)
