"""Initial administrator setup: python -m app.manage create-admin."""
import argparse
import getpass
import os
import uuid
from sqlalchemy import select, text
from .auth import hash_password
from .db import SessionLocal
from .models import User
from .security import audit
from .api.identity import email, password


def create_admin():
    target = email(os.getenv('ADMIN_EMAIL') or input('Email: '))
    value = os.getenv('ADMIN_PASSWORD') or getpass.getpass('Password: ')
    password(value)
    with SessionLocal.begin() as db:
        if db.bind.dialect.name == 'postgresql':
            db.execute(text('SELECT pg_advisory_xact_lock(7064431201)'))
        if db.scalar(select(User.id).where(User.role == 'BANK_ADMIN')):
            raise RuntimeError('Administrator already exists; use the existing account.')
        if db.scalar(select(User.id).where(User.email == target)):
            raise RuntimeError('Email already belongs to an account.')
        user = User(username='admin_' + uuid.uuid4().hex, email=target, display_name='Администратор', role='BANK_ADMIN', status='ACTIVE', password_hash=hash_password(value))
        db.add(user)
        db.flush()
        audit(db, user, 'Первый администратор создан', str(user.id))
    print('Administrator created. Credentials were not logged.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['create-admin'])
    parser.parse_args()
    create_admin()
