"""Deterministic synthetic fixtures, never a lookup of actual businesses."""
import re

FIXTURE_VERSION = 'synthetic-v1'
# Aliases preserve existing backend tests and Smirnov's seed names.
COMPANIES = {
    '7701234567': {'names': ('ООО Демо-Пекарня', 'ООО Пекарня'), 'history': 'GOOD', 'overdue': False},
    '7701234599': {'names': ('ИП Демо-Сервис', 'ИП Сервис'), 'history': 'POOR', 'overdue': True},
}


def normalize_name(value: str) -> str:
    return re.sub(r'[\s«»"\-]+', '', value).casefold().replace('ё', 'е')


def valid_inn(inn: str) -> bool:
    return len(inn) in (10, 12) and inn.isascii() and inn.isdecimal()


class MockRegistry:
    def check(self, inn: str, legal_name: str) -> dict:
        record = COMPANIES.get(inn) if valid_inn(inn) else None
        match = record is not None and normalize_name(legal_name) in {
            normalize_name(name) for name in record['names']
        }
        return {
            'registration_status': 'ACTIVE' if record else 'UNCONFIRMED',
            'requisites_match': match, 'passed': match, 'source': 'SYNTHETIC',
            'fixture_version': FIXTURE_VERSION,
            'reason': 'Реквизиты совпали с демо-реестром' if match else
                      'Компания отсутствует в демо-реестре или название не совпадает',
        }


class MockBKI:
    def check(self, inn: str) -> dict:
        record = COMPANIES.get(inn) if valid_inn(inn) else None
        return {
            'credit_history': record['history'] if record else 'UNKNOWN',
            'has_overdue': record['overdue'] if record else None,
            # Poor verified history is a completed check, not an automatic refusal.
            'passed': record is not None, 'source': 'SYNTHETIC',
            'fixture_version': FIXTURE_VERSION,
            'reason': 'История найдена в демо-БКИ' if record else 'История в демо-БКИ отсутствует',
        }
