"""PostgreSQL acceptance tests; each test owns a separate disposable schema."""
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app
from app.models import Base, Company, CreditDecision, LoanApplication, NewsItem, RiskAssessment, User
from app.seeds import demo_id, seed


@pytest.fixture
def pg(monkeypatch):
    monkeypatch.setenv('VERIFICATION_PROVIDER', 'fixtures')
    url = os.getenv("DATABASE_TEST_URL")
    if not url:
        pytest.skip("Set DATABASE_TEST_URL to an isolated PostgreSQL database")
    admin = create_engine(url)
    assert admin.dialect.name == "postgresql", "Database tests require PostgreSQL"
    schema = "test_credit_" + uuid4().hex
    with admin.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

    def migrate(target, *, down=False):
        with engine.begin() as conn:
            config.attributes["connection"] = conn
            (command.downgrade if down else command.upgrade)(config, target)

    try:
        migrate("head")
        yield engine, config, migrate
    finally:
        engine.dispose()
        # Only the generated schema created above is removed, never public/user data.
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def test_migrations_roundtrip_and_metadata(pg):
    engine, config, migrate = pg
    assert set(inspect(engine).get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
    columns = {c["name"]: c["type"] for c in inspect(engine).get_columns("risk_assessments")}
    assert str(columns["input_snapshot"]) == "JSONB"
    assert str(columns["factors"]) == "JSONB"
    with engine.begin() as conn:
        config.attributes["connection"] = conn
        command.check(config)
    migrate("base", down=True)
    assert inspect(engine).get_table_names() == ["alembic_version"]
    migrate("head")
    assert "loan_applications" in inspect(engine).get_table_names()


def test_seed_repeat_partial_repair_and_three_profiles(pg):
    engine, _, _ = pg
    with Session(engine) as db:
        seed(db, include_scenarios=True)
        db.commit()
        initial = {table.name: db.scalar(select(text("count(*)")).select_from(table))
                   for table in Base.metadata.sorted_tables}
        assert {r.risk_level for r in db.scalars(select(RiskAssessment))} == {"LOW", "MEDIUM", "HIGH"}
        user = db.scalar(select(User).where(User.username == "client_good"))
        password_hash = user.password_hash
        company = db.scalar(select(Company).where(Company.owner_user_id == user.id))
        company.legal_name = "Changed by client"
        db.delete(db.get(NewsItem, demo_id("news-food")))
        db.commit()
        seed(db, include_scenarios=True)
        db.commit()
        assert company.legal_name == "Changed by client"
        assert user.password_hash == password_hash
        assert initial == {table.name: db.scalar(select(text("count(*)")).select_from(table))
                           for table in Base.metadata.sorted_tables}


@pytest.mark.parametrize("statement", [
    "UPDATE companies SET revenue = -1",
    "UPDATE companies SET inn = 'abcdefghij' WHERE inn = '7701234567'",
    "UPDATE loan_applications SET requested_amount = 0",
    "UPDATE loan_applications SET status = 'UNKNOWN'",
    "UPDATE loan_applications SET version = 0",
    "UPDATE risk_assessments SET score = 101",
    "UPDATE users SET role = 'ADMIN'",
    "UPDATE credit_products SET max_amount = min_amount - 1",
    "DELETE FROM loan_applications",
    "INSERT INTO risk_assessments SELECT gen_random_uuid(), application_id, score, risk_level, factors, factors_schema_version, recommendation, rules_version, input_snapshot, attempt_no, created_at FROM risk_assessments LIMIT 1",
    "UPDATE verification_results SET application_id = '00000000-0000-0000-0000-000000000000'",
])
def test_database_rejects_invalid_writes(pg, statement):
    engine, _, _ = pg
    with Session(engine) as db:
        seed(db, include_scenarios=True)
        db.commit()
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(text(statement))


def test_api_create_read_resubmit_and_decision(pg, tmp_path, monkeypatch):
    engine, _, _ = pg
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    with Session(engine) as db:
        seed(db)
        db.commit()

    def sessions():
        with Session(engine, expire_on_commit=False, autoflush=False) as db:
            yield db

    app.dependency_overrides[get_db] = sessions
    try:
        with TestClient(app) as client:
            def login(name):
                r = client.post("/api/v1/auth/demo-login", json={"username": name, "password": "Demo2026!"})
                assert r.status_code == 200, r.text
                return {"Authorization": "Bearer " + r.json()["access_token"]}
            owner, bank = login("client_good"), login("banker")
            product = client.get("/api/v1/products", headers=owner).json()[0]
            created = client.post("/api/v1/applications", headers=owner, json={
                "product_id": product["id"], "amount": "400000.00", "term_months": 12,
                "purpose": product["purpose"],
            })
            assert created.status_code == 201, created.text
            aid = created.json()["id"]
            # Close pooled connections: the following read must come from durable storage.
            engine.dispose()
            assert client.get(f"/api/v1/applications/{aid}", headers=owner).json()["status"] == "DRAFT"
            assert client.post(f"/api/v1/applications/{aid}/submit", headers=owner).status_code == 200
            assert client.post(f"/api/v1/applications/{aid}/submit", headers=owner).status_code == 409
            assert client.post(f"/api/v1/bank/applications/{aid}/request-info", headers=bank,
                               json={"message": "Confirm financials"}).status_code == 200
            assert client.post(f"/api/v1/applications/{aid}/resubmit", headers=owner,
                               json={"response_message": "Confirmed"}).status_code == 200
            offer_body = {
                "type": "OFFERED", "offered_amount": "350000.00", "offered_term_months": 12,
                "offered_annual_rate": "17.50", "reason": "Demo offer",
            }
            def decide():
                return client.post(f"/api/v1/bank/applications/{aid}/decision", headers=bank, json=offer_body)
            with ThreadPoolExecutor(max_workers=2) as executor:
                decisions = list(executor.map(lambda _: decide(), range(2)))
            assert sorted(r.status_code for r in decisions) == [200, 409], [r.text for r in decisions]
            detail = client.get(f"/api/v1/applications/{aid}", headers=owner).json()
            assert detail["requested_terms"]["amount"] == "400000.00"
            assert detail["latest_offer"]["amount"] == "350000.00"
            assert client.post(f"/api/v1/applications/{aid}/accept", headers=owner).json()["current_status"] == "COMPLETED"
            with Session(engine) as db:
                assert len(db.scalars(select(RiskAssessment)).all()) == 2
                assert len(db.scalars(select(CreditDecision)).all()) == 1
                decision = db.scalar(select(CreditDecision))
                with pytest.raises(IntegrityError):
                    db.delete(db.get(LoanApplication, decision.application_id))
                    db.commit()
    finally:
        app.dependency_overrides.pop(get_db, None)
