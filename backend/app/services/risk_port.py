"""Stable workflow ports; local implementations owned by Volosnikov."""
from typing import Protocol
from .mock_services import MockBKI, MockRegistry
from .scoring import ScoringService


class RegistryPort(Protocol):
    def check(self, inn: str, legal_name: str) -> dict: ...


class BKIPort(Protocol):
    def check(self, inn: str) -> dict: ...


class ScoringPort(Protocol):
    def evaluate(self, snapshot: dict, registry_result: dict, bki_result: dict, product_terms: dict) -> dict: ...


registry_service: RegistryPort = MockRegistry()
bki_service: BKIPort = MockBKI()
scoring_service: ScoringPort = ScoringService()
