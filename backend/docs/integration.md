# Договорённости по интеграции (backend ↔ БД ↔ ML ↔ frontend)

Основание: ТЗ v1.1, разделы 6–8 и 10. **Схему БД редактирует только Смирнов**, скрипт временного SQLite bootstrap не является частью миграционной системы.

## Контракт таблиц для Смирнова

| Таблица | Что использует API |
|---|---|
| `users` | UUID id, username unique, password_hash, role |
| `companies` | id, owner_user_id, inn unique, legal_name, form, industry, months_active, revenue, expenses, debt_payment |
| `credit_products` | id, code unique, name, purpose, min_amount, max_amount, min_term, max_term, annual_rate |
| `loan_applications` | id, company_id, applicant_id, product_id, requested_amount, term_months, purpose, financial_snapshot JSONB nullable, status, version, created_at, updated_at |
| `verification_results` | id, application_id, check_type, result JSONB, passed, attempt_no, created_at |
| `risk_assessments` | id, application_id, score, risk_level, factors JSONB, recommendation, rules_version, input_snapshot JSONB, attempt_no, created_at |
| `credit_decisions` | id, application_id, decided_by, type, offer_amount, offer_term, offer_rate, reason, created_at |
| `information_requests` | id, application_id, message, status, created_at, resolved_at |
| `application_documents` | id, application_id, file_name, storage_key, mime_type, size_bytes, created_at |
| `application_events` | id, application_id, actor_id nullable, from_status nullable, to_status, reason, occurred_at |
| `news_items` | id, title, body, target_industry nullable, target_purpose nullable |

Важные места для согласования: в ТЗ встречаются одновременно `rule_version` и `rules_version`, здесь выбрано `rules_version`. Ставки и суммы всегда `Decimal`, в JSON передаются как **строки**. Даты в API в UTC ISO 8601; нулевой actor_id означает автоматическое событие. Поле `version` в заявке означает текущий номер попытки проверки, начинается с 1. `input_snapshot` не меняется при повторной подаче, создаётся **новая строка** RiskAssessment. Нельзя перезаписывать `requested_amount` и `term_months` при банковском оффере.

Канонические модели находятся в `app/models.py`, начальная миграция — `alembic/versions/0001_canonical_credit_database.py`. Ограничения, индексы, запуск PostgreSQL, ER-схема и DBeaver описаны в [data-model.md](data-model.md). Изменения структуры по-прежнему принадлежат владельцу БД и оформляются новой миграцией. Поле `risk_assessments.factors_schema_version` хранит версию структуры JSON-списка факторов; API продолжает возвращать `factors` как список.

## Интерфейс для Волосникова

См. `app/services/risk_port.py`:

```python
registry_service.check(inn: str, legal_name: str) -> dict
# {'registration_status': 'ACTIVE', 'requisites_match': True,
#  'passed': True, 'source': 'SYNTHETIC'}

bki_service.check(inn: str) -> dict
# {'credit_history': 'GOOD', 'has_overdue': False,
#  'passed': True, 'source': 'SYNTHETIC'}

scoring_service.evaluate(snapshot, registry_result, bki_result, product_terms) -> dict
# {'score': 84, 'risk_level': 'LOW', 'factors': [
#   {'code':'...', 'direction':'POSITIVE', 'points':35, 'explanation':'...'}, ...],
#  'recommendation':'...', 'rules_version':'v1'}
```

- Скоринг никогда не должен сам устанавливать OFFERED/REJECTED: это делает сотрудник банка через API.
- Неизвестные/неверифицированные данные не должны считаться позитивным фактором.
- 0–49 = HIGH, 50–74 = MEDIUM, 75–100 = LOW.
- Все вызовы локальные, без платных API и без реальных данных клиентов.
- Подключены `MockRegistry`, `MockBKI`, `ScoringService` Волосникова. Правила `volosnikov-rules-v1`, моки `synthetic-v1`; данные и границы — в [scoring.md](scoring.md). Неизвестный ИНН и несовпадающее название отправляются на уточнение.

## Для фронта Смирнова

Основной контракт: `openapi.json` (сгенерирован из кода). Путь `/api/v1`. Схемы `ApplicationResponse`, `StatusResponse`, `BankApplicationResponse`, `ErrorResponse` доступны в Swagger; все деньги в JSON в строках.

Authorization: `Bearer <token>` из `/auth/demo-login`. Клиент видит только своё; чужой UUID возвращает 404. Для сотрудника банка есть `/bank/applications` и `/bank/applications/{id}`, включая `risk`, `verifications`, `information_requests`, `events`, `documents`. Запросы по некорректным переходам получают 409. Не используйте редактирование `requested_terms` после SUBMITTED.

При первом POST `/submit` последовательность статусов может завершиться `UNDER_REVIEW` уже в ответе (автоматические проверки синхронные), но `SUBMITTED` и `VERIFYING` остаются в `history`. После запроса сведений клиент загружает PDF и вызывает `/resubmit` с необязательными изменениями финансов/реквизитов. Клиент по OFFERED делает `/accept` или `/decline`.

## Критичные интеграционные проверки

- Прогнать тесты сначала на SQLite для API и затем на PostgreSQL с миграциями Смирнова.
- Проверить конкурентную попытку двух банковских решений для одной заявки на PostgreSQL.
- Сверить имена полей ORM с миграциями перед merge; не вызывать `Base.metadata.create_all()` при старте FastAPI.
- В итоговом Docker Compose смонтировать UPLOAD_DIR на постоянный volume.
- После реальной замены демо-адаптеров повторить сценарии здоровой и рискованной компании.
