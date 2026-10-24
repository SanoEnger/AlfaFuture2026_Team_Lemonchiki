import os
from sqlalchemy.orm import Session
from ..models import Company, CreditProduct, InformationRequest, LoanApplication, RiskAssessment, VerificationResult
from ..schemas import Status
from .workflow import transition
from . import risk_port


def take_snapshot(company: Company, app: LoanApplication) -> dict:
    return {
        'schema_version': 1,
        'application_version': app.version,
        'inn': company.inn,
        'legal_name': company.legal_name,
        'form': company.form,
        'industry': company.industry,
        'revenue': str(company.revenue),
        'expenses': str(company.expenses),
        'debt_payment': str(company.debt_payment),
        'months_active': company.months_active,
    }


def run_checks(db: Session, app: LoanApplication, company: Company, product: CreditProduct) -> str:
    """Synchronous local workflow. Caller commits once with events/results/status."""
    transition(db, app, Status.VERIFYING, reason='Запуск автоматических проверок')
    snapshot = take_snapshot(company, app)
    app.financial_snapshot = snapshot
    if os.getenv('VERIFICATION_PROVIDER', 'records') == 'records':
        valid = len(company.inn) in (10, 12) and company.inn.isascii() and company.inn.isdecimal() and bool(company.legal_name.strip())
        registry = {'passed': valid, 'source': 'COMPANY_RECORD', 'registration_status': 'UNKNOWN', 'requisites_match': False, 'message': 'Проверен формат реквизитов. Внешний реестр не подключён; сведения требуют проверки сотрудником.'}
        bki = {'passed': True, 'source': 'MANUAL_REVIEW', 'credit_history': 'UNKNOWN', 'has_overdue': None, 'message': 'БКИ не подключено. Кредитная история не подтверждена; требуется ручное рассмотрение.'}
    else:
        registry = risk_port.registry_service.check(company.inn, company.legal_name)
        bki = risk_port.bki_service.check(company.inn)
    for kind, result in (('REGISTRY', registry), ('BKI', bki)):
        db.add(VerificationResult(application_id=app.id, check_type=kind, result={'schema_version': 1, **result}, passed=bool(result.get('passed', False)), attempt_no=app.version))
    if not registry.get('passed') or not bki.get('passed'):
        db.add(InformationRequest(application_id=app.id, message='Автопроверка выявила несоответствие. Уточните сведения о компании.', status='OPEN'))
        transition(db, app, Status.NEEDS_INFO, reason='Не все автоматические проверки пройдены')
        return 'NEEDS_INFO'
    score = risk_port.scoring_service.evaluate(snapshot, registry, bki, {'amount': str(app.requested_amount), 'term_months': app.term_months, 'annual_rate': str(product.annual_rate)})
    db.add(RiskAssessment(application_id=app.id, score=score['score'], risk_level=score['risk_level'], factors=score['factors'], recommendation=score['recommendation'], rules_version=score['rules_version'], input_snapshot=snapshot, attempt_no=app.version))
    transition(db, app, Status.UNDER_REVIEW, reason='Проверки и расчёт риска завершены')
    return 'COMPLETED'
