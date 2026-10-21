"""Demo seed only; database tables must already exist (Smirnov's migration)."""
from decimal import Decimal
from sqlalchemy import select
from .auth import hash_password
from .db import SessionLocal
from .models import Company, CreditProduct, NewsItem, User


def seed():
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            print('Seed skipped: users exist')
            return
        password = hash_password('Demo2026!')
        good = User(username='client_good', password_hash=password, role='CLIENT')
        risky = User(username='client_risky', password_hash=password, role='CLIENT')
        banker = User(username='banker', password_hash=password, role='BANK_EMPLOYEE')
        db.add_all([good, risky, banker])
        db.flush()
        db.add_all([
            Company(owner_user_id=good.id, inn='7701234567', legal_name='ООО Демо-Пекарня', form='ООО', industry='FOOD', months_active=48, revenue=Decimal('1400000'), expenses=Decimal('650000'), debt_payment=Decimal('50000')),
            Company(owner_user_id=risky.id, inn='7701234599', legal_name='ИП Демо-Сервис', form='ИП', industry='SERVICES', months_active=3, revenue=Decimal('180000'), expenses=Decimal('175000'), debt_payment=Decimal('40000')),
            CreditProduct(code='WORKING_CAPITAL', name='Оборотный', purpose='WORKING_CAPITAL', min_amount=Decimal('50000'), max_amount=Decimal('5000000'), min_term=3, max_term=36, annual_rate=Decimal('18.00')),
            CreditProduct(code='INVESTMENT', name='Инвестиционный', purpose='INVESTMENT', min_amount=Decimal('100000'), max_amount=Decimal('15000000'), min_term=6, max_term=84, annual_rate=Decimal('17.50')),
            NewsItem(title='Оборотный капитал для пищевого бизнеса', body='Синтетическая новость для демонстрации персонализации.', target_industry='FOOD'),
            NewsItem(title='Управление затратами в сервисе', body='Синтетическая публикация для сервисных компаний.', target_industry='SERVICES'),
            NewsItem(title='Финансовое планирование МСП', body='Синтетические общие рекомендации для предпринимателей.'),
        ])
        db.commit()
        print('Demo seed created: client_good, client_risky, banker / Demo2026!')


if __name__ == '__main__':
    seed()
