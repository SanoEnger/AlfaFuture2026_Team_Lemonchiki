"""Initialize the product catalog without creating accounts or applications."""
from decimal import Decimal
from sqlalchemy import select
from .db import SessionLocal
from .models import CreditProduct, NewsItem, Company, LoanApplication, ApplicationEvent, RiskAssessment, VerificationResult, User
from .seeds import demo_id as stable_id


def initialize(db, *, retire_legacy_accounts=True):
    if retire_legacy_accounts:
        from .auth import verify_password
        from .security import revoke_sessions
        for name in ('client_good', 'client_risky', 'banker'):
            user = db.get(User, stable_id(name))
            if user and user.username == name and user.email is None and user.status != 'SUSPENDED' and verify_password('Demo2026!', user.password_hash):
                user.status = 'SUSPENDED'
                revoke_sessions(db, user)
    # Normalize only untouched records shipped by the old seed. Keep IDs, amounts,
    # custom names and historical decisions intact.
    for key, old, new in (('company-good', 'ООО Демо-Пекарня', 'ООО Пекарня'), ('company-risky', 'ИП Демо-Сервис', 'ИП Сервис')):
        company = db.get(Company, stable_id(key))
        if company and company.legal_name == old:
            company.legal_name = new
    for level in ('LOW', 'MEDIUM', 'HIGH'):
        application_id = stable_id('scenario-' + level)
        application = db.get(LoanApplication, application_id)
        if not application:
            continue
        for event in db.scalars(select(ApplicationEvent).where(ApplicationEvent.application_id == application_id)):
            translations = {'Демо-сценарий ' + level: 'Заявка создана', 'Демо-подача': 'Заявка отправлена', 'Демо-проверки': 'Проверки запущены', 'Демо-скоринг завершён': 'Расчёт риска завершён'}
            event.reason = translations.get(event.reason, event.reason)
        for assessment in db.scalars(select(RiskAssessment).where(RiskAssessment.application_id == application_id)):
            assessment.recommendation = assessment.recommendation.replace('демонстрационный риск', 'расчётный риск')
        for verification in db.scalars(select(VerificationResult).where(VerificationResult.application_id == application_id)):
            result = dict(verification.result)
            result['source'] = 'HISTORICAL_RECORD'
            result['message'] = 'Историческая запись проверки. Для нового решения требуется актуальная проверка сотрудником.'
            if 'reason' in result:
                result['reason'] = 'Сохранённый результат проверки'
            verification.result = result
    for key, code, name, minimum, maximum, short, long, rate in (
        ('working-capital', 'WORKING_CAPITAL', 'Оборотный кредит', '50000', '5000000', 3, 36, '18.00'),
        ('investment', 'INVESTMENT', 'Инвестиционный кредит', '100000', '15000000', 6, 84, '17.50'),
    ):
        if not db.scalar(select(CreditProduct.id).where(CreditProduct.code == code)):
            db.add(CreditProduct(id=stable_id(key), code=code, name=name, purpose=code, min_amount=Decimal(minimum), max_amount=Decimal(maximum), min_term=short, max_term=long, annual_rate=Decimal(rate)))
    for key, title, industry, purpose, body in (
        ('news-food', 'Оборотный капитал для пищевого бизнеса', 'FOOD', None, 'Планируйте закупки сырья с учётом сезонности и сроков поставок. Сопоставляйте потребность в оборотных средствах с поступлениями от клиентов.'),
        ('news-services', 'Управление затратами в сервисе', 'SERVICES', None, 'Отслеживайте загрузку команды, постоянные расходы и сроки оплаты. Эти показатели помогают оценивать потребность в финансировании.'),
        ('news-common', 'Финансовое планирование бизнеса', None, None, 'Составляйте план поступлений и платежей, учитывайте обязательные расходы и резерв. Перед подачей заявки проверьте актуальность финансовых показателей.'),
        ('news-investment', 'Планирование инвестиций в оборудование', None, 'INVESTMENT', 'Оцените, как новое оборудование повлияет на выручку и расходы. Сопоставьте срок окупаемости с графиком платежей.'),
    ):
        record = db.get(NewsItem, stable_id(key))
        if record is None:
            db.add(NewsItem(id=stable_id(key), title=title, body=body, target_industry=industry, target_purpose=purpose))
        elif record.body == 'Синтетическая публикация для демонстрации. Не является рекомендацией банка.':
            record.body = body


if __name__ == '__main__':
    with SessionLocal.begin() as db:
        initialize(db)
    print('Product catalog initialized.')
