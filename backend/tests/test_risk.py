"""Risk rules, trust boundaries and compatibility with the canonical seed."""
from copy import deepcopy
import json

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import Base, RiskAssessment
from app.seeds import seed
from app.services.mock_services import MockBKI, MockRegistry
from app.services.scoring import ScoringService


TERMS = {'amount': '400000', 'term_months': 12, 'annual_rate': '18'}
PROFILES = [
    ('7701234567', 'ООО Демо-Пекарня', 48, '1400000', '650000', '50000', 100, 'LOW'),
    ('7701234567', 'ООО Демо-Пекарня', 18, '300000', '240000', '20000', 66, 'MEDIUM'),
    ('7701234599', 'ИП Демо-Сервис', 3, '180000', '175000', '40000', 20, 'HIGH'),
]


def inputs(profile=PROFILES[0]):
    inn, name, months, revenue, expenses, debt, _, _ = profile
    return ({'months_active': months, 'revenue': revenue, 'expenses': expenses, 'debt_payment': debt},
            MockRegistry().check(inn, name), MockBKI().check(inn), deepcopy(TERMS))


@pytest.mark.parametrize('profile', PROFILES)
def test_three_profiles_deterministic_and_explainable(profile):
    args = inputs(profile)
    before = deepcopy(args)
    result = ScoringService().evaluate(*args)
    assert result == ScoringService().evaluate(*args)
    assert args == before
    assert (result['score'], result['risk_level']) == profile[-2:]
    assert sum(f['points'] for f in result['factors']) == result['score']
    assert len(result['factors']) >= 3
    assert all(f['explanation'] for f in result['factors'])
    assert result['rules_version'] == 'volosnikov-rules-v1'
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize('inn', ['7701234598', '0000000000', 'abc', '７７０１２３４５６７'])
def test_unknown_company_is_never_verified(inn):
    assert MockRegistry().check(inn, 'ООО Демо-Пекарня')['passed'] is False
    result = MockBKI().check(inn)
    assert result['passed'] is False
    assert result['credit_history'] == 'UNKNOWN'
    assert result['has_overdue'] is None


def test_registry_requisites_and_bad_history_are_distinct():
    assert MockRegistry().check('7701234567', 'Другая компания')['passed'] is False
    assert MockRegistry().check('7701234567', '  ООО «Демо-Пекарня» ')['passed'] is True
    assert MockBKI().check('7701234599')['passed'] is True
    assert MockBKI().check('7701234599')['has_overdue'] is True


@pytest.mark.parametrize('bki', [{}, {'passed': True},
    {'passed': True, 'credit_history': 'UNKNOWN', 'has_overdue': False},
    {'passed': True, 'credit_history': 'GOOD', 'has_overdue': None},
    {'passed': False, 'credit_history': 'GOOD', 'has_overdue': False},
    {'passed': True, 'credit_history': 'GOOD', 'has_overdue': True}])
def test_missing_or_overdue_history_never_receives_history_points(bki):
    snapshot, registry, _, terms = inputs()
    result = ScoringService().evaluate(snapshot, registry, bki, terms)
    assert next(f for f in result['factors'] if f['code'] == 'CREDIT_HISTORY')['points'] == 0


def test_unverified_registry_gives_no_positive_factors():
    snapshot, _, bki, terms = inputs()
    result = ScoringService().evaluate(snapshot, {}, bki, terms)
    assert result['score'] == 0
    assert all(f['direction'] != 'POSITIVE' for f in result['factors'])


def test_zero_interest_and_zero_revenue():
    snapshot, registry, bki, terms = inputs()
    terms['annual_rate'] = '0'
    assert ScoringService().evaluate(snapshot, registry, bki, terms)['score'] == 100
    snapshot.update(revenue='0', expenses='0', debt_payment='0', months_active=0)
    assert ScoringService().evaluate(snapshot, registry, bki, terms)['risk_level'] == 'HIGH'


@pytest.mark.parametrize('key,value', [('revenue', '-1'), ('expenses', 'NaN'),
    ('debt_payment', 'Infinity'), ('months_active', '1.5')])
def test_invalid_financials_fail_explicitly(key, value):
    args = inputs()
    args[0][key] = value
    with pytest.raises(ValueError):
        ScoringService().evaluate(*args)


@pytest.mark.parametrize('key,value', [('amount', '0'), ('amount', '-1'),
    ('annual_rate', '-1'), ('term_months', '0'), ('term_months', '1.2')])
def test_invalid_terms_fail_explicitly(key, value):
    args = inputs()
    args[3][key] = value
    with pytest.raises(ValueError):
        ScoringService().evaluate(*args)


@pytest.mark.parametrize('age,history,expenses,debt,amount,score,risk', [
    (0, 'FAIR', '240000', '20000', '400000', 48, 'HIGH'),
    (0, 'POOR', '240000', '0', '200000', 50, 'MEDIUM'),
    (36, 'GOOD', '240000', '20000', '400000', 73, 'MEDIUM'),
    (0, 'FAIR', '200000', '20000', '400000', 75, 'LOW'),
])
def test_risk_thresholds(age, history, expenses, debt, amount, score, risk):
    snapshot, registry, bki, terms = inputs()
    snapshot.update(revenue='300000', expenses=expenses, debt_payment=debt, months_active=age)
    bki['credit_history'] = history
    terms['amount'] = amount
    result = ScoringService().evaluate(snapshot, registry, bki, terms)
    assert (result['score'], result['risk_level']) == (score, risk)


def test_smirnov_seed_uses_final_services_and_is_repeatable():
    engine = create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed(db, include_scenarios=True)
        db.commit()
        seed(db, include_scenarios=True)
        db.commit()
        risks = db.scalars(select(RiskAssessment)).all()
        assert len(risks) == 3
        assert {(r.score, r.risk_level) for r in risks} == {(100, 'LOW'), (66, 'MEDIUM'), (20, 'HIGH')}
        assert all(r.rules_version == ScoringService.RULES_VERSION for r in risks)
    engine.dispose()
