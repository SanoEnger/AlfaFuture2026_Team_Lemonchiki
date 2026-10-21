"""Replaceable local implementations; Volosnikov owns the final MockRegistry/MockBKI/scoring.

Public plug-in interface: evaluate(snapshot, registry_result, bki_result, product_terms).
Never call a third-party API and never interpret outputs as a real bank decision.
"""
from decimal import Decimal
from typing import Protocol


class RegistryPort(Protocol):
    def check(self, inn: str, legal_name: str) -> dict: ...


class BKIPort(Protocol):
    def check(self, inn: str) -> dict: ...


class ScoringPort(Protocol):
    def evaluate(self, snapshot: dict, registry_result: dict, bki_result: dict, product_terms: dict) -> dict: ...


class DemoRegistry:
    def check(self, inn: str, legal_name: str) -> dict:
        # Deliberately synthetic. Use demo values only. Invalid demo marker simulates mismatch.
        ok = bool(legal_name.strip()) and not inn.startswith('000')
        return {'registration_status': 'ACTIVE' if ok else 'UNCONFIRMED', 'requisites_match': ok, 'passed': ok, 'source': 'SYNTHETIC'}


class DemoBKI:
    def check(self, inn: str) -> dict:
        # Demo data protocol: suffix 99 is the high-risk seeded scenario.
        bad = inn.endswith('99')
        return {'credit_history': 'POOR' if bad else 'GOOD', 'has_overdue': bad, 'passed': True, 'source': 'SYNTHETIC'}


class DemoScoring:
    RULES_VERSION = 'demo-reference-v1'  # Not final scoring owned by Volosnikov.

    def evaluate(self, snapshot: dict, registry_result: dict, bki_result: dict, product_terms: dict) -> dict:
        revenue = Decimal(snapshot['revenue'])
        expenses = Decimal(snapshot['expenses'])
        debts = Decimal(snapshot['debt_payment'])
        cash_flow = revenue - expenses
        free_cash = cash_flow - debts
        months = int(snapshot['months_active'])
        amount = Decimal(product_terms['amount'])
        term = int(product_terms['term_months'])
        annual_rate = Decimal(product_terms['annual_rate']) / Decimal(100)
        monthly_rate = annual_rate / Decimal(12)
        payment = amount / Decimal(term) if monthly_rate == 0 else amount * monthly_rate / (1 - (1 + monthly_rate) ** (-term))

        financial = 35 if revenue > 0 and cash_flow / revenue >= Decimal('.3') else 20 if cash_flow > 0 else 0
        coverage = free_cash / payment if payment > 0 else Decimal(0)
        debt = 30 if coverage >= 2 else 18 if coverage >= 1 else 0
        age = 15 if months >= 36 else 8 if months >= 12 else 0
        history = 0 if bki_result.get('has_overdue') else 20
        score = financial + debt + age + history
        risk = 'LOW' if score >= 75 else 'MEDIUM' if score >= 50 else 'HIGH'
        factors = [
            {'code': 'MARGIN', 'direction': 'POSITIVE' if financial >= 20 else 'NEGATIVE', 'points': financial, 'explanation': 'Финансовая устойчивость компании'},
            {'code': 'DEBT_COVERAGE', 'direction': 'POSITIVE' if debt >= 18 else 'NEGATIVE', 'points': debt, 'explanation': 'Свободный денежный поток и покрытие платежа'},
            {'code': 'BUSINESS_AGE', 'direction': 'POSITIVE' if age >= 8 else 'NEGATIVE', 'points': age, 'explanation': 'Срок работы бизнеса'},
            {'code': 'CREDIT_HISTORY', 'direction': 'NEGATIVE' if history == 0 else 'POSITIVE', 'points': history, 'explanation': 'Синтетическая история БКИ'},
        ]
        return {'score': score, 'risk_level': risk, 'factors': factors, 'recommendation': 'Рекомендуется изучить и принять решение вручную' if score >= 50 else 'Высокий риск; рекомендуется дополнительная проверка', 'rules_version': self.RULES_VERSION}


# Interface injection point for Volosnikov's implementation.
registry_service: RegistryPort = DemoRegistry()
bki_service: BKIPort = DemoBKI()
scoring_service: ScoringPort = DemoScoring()
