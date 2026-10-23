"""Explainable educational score. The employee owns the final decision."""
from decimal import Decimal, localcontext


def number(data: dict, key: str, *, positive: bool = False) -> Decimal:
    value = Decimal(str(data[key]))
    if not value.is_finite() or value < 0 or (positive and value == 0):
        raise ValueError(f'{key}: требуется конечное неотрицательное число, ненулевое для суммы/срока')
    return value


class ScoringService:
    RULES_VERSION = 'volosnikov-rules-v1'

    def evaluate(self, snapshot: dict, registry_result: dict, bki_result: dict, product_terms: dict) -> dict:
        revenue = number(snapshot, 'revenue')
        expenses = number(snapshot, 'expenses')
        debts = number(snapshot, 'debt_payment')
        months = number(snapshot, 'months_active')
        amount = number(product_terms, 'amount', positive=True)
        term = number(product_terms, 'term_months', positive=True)
        rate = number(product_terms, 'annual_rate')
        if term != term.to_integral_value() or months != months.to_integral_value():
            raise ValueError('Сроки должны быть целыми месяцами')
        with localcontext() as context:
            context.prec = 36
            monthly_rate = rate / 1200
            payment = amount / term if monthly_rate == 0 else amount * monthly_rate / (
                1 - (1 + monthly_rate) ** (-int(term)))
            cash_flow = revenue - expenses
            margin = cash_flow / revenue if revenue else Decimal(0)
            coverage = (cash_flow - debts) / payment

        verified = (registry_result.get('passed') is True and
                    registry_result.get('registration_status') == 'ACTIVE' and
                    registry_result.get('requisites_match') is True)
        financial = (35 if margin >= Decimal('.30') and revenue > 0 else
                     20 if cash_flow > 0 else 0) if verified else 0
        debt = (30 if coverage >= 2 else 18 if coverage >= 1 else 0) if verified else 0
        age = (15 if months >= 36 else 8 if months >= 12 else 0) if verified else 0
        history_known = (verified and bki_result.get('passed') is True and
                         bki_result.get('credit_history') in ('GOOD', 'FAIR', 'POOR') and
                         type(bki_result.get('has_overdue')) is bool)
        history = 0
        if history_known and bki_result['has_overdue'] is False:
            history = {'GOOD': 20, 'FAIR': 10, 'POOR': 0}[bki_result['credit_history']]

        def factor(code, points, explanation):
            return {'code': code, 'direction': 'POSITIVE' if points else 'NEGATIVE',
                    'points': points, 'explanation': explanation}

        factors = [
            factor('MARGIN', financial, f'Операционная маржа {margin:.1%}; {financial} из 35 баллов.'),
            factor('DEBT_COVERAGE', debt, f'Платёж {payment:.2f} в месяц; покрытие свободным потоком {coverage:.2f}; {debt} из 30 баллов.'),
            factor('BUSINESS_AGE', age, f'Возраст бизнеса {months} мес.; {age} из 15 баллов.'),
            factor('CREDIT_HISTORY', history, f'История {bki_result.get("credit_history", "UNKNOWN")}; '
                   f'просрочки: {bki_result.get("has_overdue")}; {history} из 20 баллов.'),
        ]
        if not verified or not history_known:
            factors.append(factor('UNVERIFIED_DATA', 0, 'Часть данных не подтверждена. Неподтверждённые сведения не дают положительных баллов.'))
        score = financial + debt + age + history
        risk = 'LOW' if score >= 75 else 'MEDIUM' if score >= 50 else 'HIGH'
        recommendation = {
            'LOW': 'Низкий демонстрационный риск. Сотруднику проверить условия и принять решение.',
            'MEDIUM': 'Средний демонстрационный риск. Рассмотреть уточнение данных или встречные условия.',
            'HIGH': 'Высокий демонстрационный риск. Требуется углублённое ручное рассмотрение.',
        }[risk]
        return {'score': score, 'risk_level': risk, 'factors': factors,
                'recommendation': recommendation, 'rules_version': self.RULES_VERSION}
