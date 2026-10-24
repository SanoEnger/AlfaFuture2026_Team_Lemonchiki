from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from app.models import Base, User, Company, LoanApplication, CreditProduct
from app.bootstrap import initialize
from app.auth import hash_password
from app.seeds import demo_id


def test_startup_creates_catalog_without_accounts_or_applications():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        initialize(db)
        db.commit()
        initialize(db)
        db.commit()
        assert db.scalar(select(func.count()).select_from(CreditProduct)) == 2
        for model in (User, Company, LoanApplication):
            assert db.scalar(select(func.count()).select_from(model)) == 0
    engine.dispose()


def test_startup_retires_unchanged_legacy_credentials_and_keeps_custom_passwords():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        old = User(id=demo_id('client_good'), username='client_good', password_hash=hash_password('Demo2026!'), role='CLIENT')
        customized = User(id=demo_id('banker'), username='banker', password_hash=hash_password('PersonalStrong42'), role='BANK_EMPLOYEE')
        db.add_all([old, customized])
        db.commit()
        initialize(db)
        db.commit()
        assert old.status == 'SUSPENDED'
        assert old.session_version == 2
        assert customized.status == 'ACTIVE'
        assert customized.session_version == 1
        initialize(db)
        db.commit()
        assert old.session_version == 2
        assert db.get(User, old.id).role == 'CLIENT'
    engine.dispose()
