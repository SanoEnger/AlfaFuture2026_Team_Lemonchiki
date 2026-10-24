from pathlib import Path
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text


def test_identity_extension_preserves_legacy_accounts(monkeypatch):
    """Exercise 0002 against a pre-existing schema, including explicit CHECK names."""
    monkeypatch.setenv('DATABASE_URL', 'sqlite+pysqlite:///:memory:')
    engine = create_engine('sqlite+pysqlite:///:memory:')
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / 'alembic.ini'))
    config.set_main_option('script_location', str(root / 'alembic'))
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id CHAR(32) PRIMARY KEY, username VARCHAR(100) NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(24) NOT NULL, CONSTRAINT ck_users_role CHECK(role IN ('CLIENT','BANK_EMPLOYEE')))"))
        connection.execute(text('CREATE TABLE loan_applications (id CHAR(32) PRIMARY KEY)'))
        user_id = uuid4().hex
        connection.execute(text("INSERT INTO users VALUES (:id,'existing','unchanged-hash','CLIENT')"), {'id': user_id})
        config.attributes['connection'] = connection
        command.stamp(config, '0001')
        command.upgrade(config, 'head')
        assert connection.execute(text('SELECT id, username, password_hash, role, display_name, status FROM users')).one() == (user_id, 'existing', 'unchanged-hash', 'CLIENT', 'existing', 'ACTIVE')
        command.downgrade(config, '0001')
        assert connection.execute(text('SELECT id, username, password_hash, role FROM users')).one() == (user_id, 'existing', 'unchanged-hash', 'CLIENT')
        command.upgrade(config, 'head')
    engine.dispose()
