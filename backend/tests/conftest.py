import os
os.environ['DATABASE_URL'] = 'sqlite+pysqlite:///:memory:'
os.environ['APP_SECRET_KEY'] = 'tests-only-very-long-secret-not-for-production-12345'

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db import get_db
from app.models import Base, Company, CreditProduct, NewsItem, User
from app.auth import hash_password


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv('VERIFICATION_PROVIDER', 'fixtures')
    monkeypatch.setenv('VERIFICATION_PROVIDER', 'fixtures')
    monkeypatch.setenv('UPLOAD_DIR', str(tmp_path))
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)  # tests only: never create_all in production.
    Factory = sessionmaker(bind=engine, expire_on_commit=False)
    with Factory() as db:
        password = hash_password('Test2026!')
        good = User(username='good', password_hash=password, role='CLIENT')
        risky = User(username='risky', password_hash=password, role='CLIENT')
        banker = User(username='banker', password_hash=password, role='BANK_EMPLOYEE')
        db.add_all([good, risky, banker])
        db.flush()
        db.add_all([
            Company(owner_user_id=good.id, inn='7701234567', legal_name='ООО Пекарня', form='ООО', industry='FOOD', months_active=60, revenue=Decimal('2000000'), expenses=Decimal('700000'), debt_payment=Decimal('10000')),
            Company(owner_user_id=risky.id, inn='7701234599', legal_name='ИП Сервис', form='ИП', industry='SERVICES', months_active=2, revenue=Decimal('50000'), expenses=Decimal('51000'), debt_payment=Decimal('15000')),
            CreditProduct(code='WORKING_CAPITAL', name='Оборотный', purpose='WORKING_CAPITAL', min_amount=Decimal('50000'), max_amount=Decimal('5000000'), min_term=3, max_term=36, annual_rate=Decimal('18.00')),
            NewsItem(title='Food news', body='synthetic', target_industry='FOOD'),
            NewsItem(title='Services news', body='synthetic', target_industry='SERVICES'),
        ])
        db.commit()
    def override():
        with Factory() as session:
            yield session
    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        yield client, Factory
    app.dependency_overrides.clear()
    engine.dispose()


def headers(client, username):
    reply = client.post('/api/v1/auth/demo-login', json={'username': username, 'password': 'Test2026!'})
    assert reply.status_code == 200, reply.text
    return {'Authorization': f"Bearer {reply.json()['access_token']}"}


def new_app(client, auth):
    p = client.get('/api/v1/products', headers=auth).json()[0]
    reply = client.post('/api/v1/applications', headers=auth, json={'product_id': p['id'], 'amount': '400000.00', 'term_months': 12, 'purpose': 'WORKING_CAPITAL'})
    assert reply.status_code == 201, reply.text
    return reply.json()['id']
