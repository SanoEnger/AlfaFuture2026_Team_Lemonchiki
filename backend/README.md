# Alfa Hack 2026: Smart Credit Backend

**Исполнитель: Вахрушев (VK-01 — VK-06)**  
Реализация изолированного backend-модуля по ТЗ «Умный кредитный кабинет предпринимателя», версия 1.1. Проект содержит синтетические данные и не выдаёт реальные кредиты.

## Реализовано

- FastAPI + Pydantic v2 + SQLAlchemy 2.x, REST API с OpenAPI `/docs`, `/openapi.json`;
- demo-login с хешированными паролями, подписанными Bearer JWT, серверные права CLIENT/BANK_EMPLOYEE и контроль собственника;
- каталог двух продуктов, профиль компании, синтетические новости, создание / редактирование DRAFT, валидация сумм и срока;
- workflow с контролируемыми переходами, историей событий и версионным financial snapshot;
- синтетическая проверка реестра/БКИ, подключаемый скоринг, сохраняемые результаты каждой попытки;
- банк: очередь, карточка, оценки риска, документы, запрос уточнений, предложение/отказ;
- клиент: загрузка PDF, ответ на уточнение с новой попыткой, принятие/отклонение оффера;
- атомарная запись решений и переходов в SQLAlchemy session; повторные действия отклоняются кодом 409;
- тесты unit/integration с временной SQLite; экспортер OpenAPI.

**Граница интеграции:** `app/models.py` содержит временные SQLAlchemy-модели для локальной разработки. Это НЕ миграции: окончательные ORM-модели, индексы, Alembic и seed-данные принадлежат Смирнову. После объединения модели надо согласовать с его схемой, а PostgreSQL разворачивать только через его миграции. `app/services/risk_port.py` содержит демонстрационные резервные реализации, которые заменяются локальными модулями Волосникова. Docker Compose и общий релиз принадлежат Волосникову. **Без этих интеграций это не собранный командный MVP.**

## Быстрый запуск backend локально

Требования: Python 3.12/3.13, `pip`. В Windows PowerShell:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
$env:DATABASE_URL = "sqlite+pysqlite:///./demo.db"
$env:APP_SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
$env:UPLOAD_DIR = "./storage"
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
python scripts/bootstrap_dev_sqlite.py
uvicorn app.main:app --reload
```

Если Python 3.12 не установлен, можно попробовать `py -3.13 -m venv .venv` (в `pyproject.toml` 3.13 разрешён). Команды выше создают отдельную **одноразовую SQLite БД для разработки**, не схему релизного PostgreSQL. Для Windows CMD вместо `$env:KEY = ...` используются `set`-команды.

После запуска: <http://127.0.0.1:8000/docs>, здоровье <http://127.0.0.1:8000/health>.

Demo-аккаунты локального seed (только синтетические):

| Логин | Пароль | Роль |
|---|---|---|
| `client_good` | `Demo2026!` | CLIENT |
| `client_risky` | `Demo2026!` | CLIENT |
| `banker` | `Demo2026!` | BANK_EMPLOYEE |

Для чистой повторной инициализации локальной базы удалите `demo.db` **только если в ней нет нужной информации**. База PostgreSQL этими скриптами не создаётся и не модифицируется в структуре.

## Проверка

```bash
python -m pytest -q
python scripts/export_openapi.py
python scripts/export_postman.py
```

Для экспорта OpenAPI `DATABASE_URL` должен указывать на доступный SQLAlchemy-драйвер (например, временный SQLite), фактическое подключение к серверу БД не требуется. В архиве уже приложены `openapi.json` для Смирнова и `smart_credit.postman_collection.json` для ручных интеграционных проверок в Postman.

## Порядок для командной интеграции

1. **Смирнов:** сверить имена полей/таблиц из `docs/integration.md`, заменить предварительные модели на канонические и применить миграции PostgreSQL. Проверить `CreditDecision` и поля `rules_version`, `attempt_no`.
2. **Волосников:** в `app/services/risk_port.py` присвоить `registry_service`, `bki_service`, `scoring_service` реальные локальные реализации, соблюдающие Protocol; скомпоновать API, PostgreSQL, UI и storage в Docker Compose.
3. **Вахрушев:** обновить адаптеры к финальной ORM, прогнать тесты на PostgreSQL, перепроверить транзакции и 403/404/409/422, согласовать финальный `openapi.json`.
4. **Смирнов:** подключить React к префиксу `/api/v1`, отобразить `next_action`, `latest_offer`, историю и `documents`.

Переходы, ограничения, контракты ошибок и примеры запросов: [`docs/api_contract.md`](docs/api_contract.md), [`docs/integration.md`](docs/integration.md), [`docs/workflow.md`](docs/workflow.md).

## Не реализовано в этом отдельном модуле

- реальные банковские интеграции, выдача денег, реальные персональные данные;
- PostgreSQL/Alembic от Смирнова, Docker Compose и итоговый E2E с UI;
- финальный скоринг и MockRegistry/MockBKI Волосникова;
- OAuth/SSO, продакшен-аутентификация, антивирусная проверка PDF и распределённая задача очереди. Это не требуется для локального демо.

Вопросы надёжности: для PostgreSQL используются `SELECT ... FOR UPDATE` и единый commit на изменение статуса/решение/историю; повторная операция получает 409. `APP_SECRET_KEY` должен быть уникальным и находиться вне Git, как и переменные окружения. PDF хранится в отдельном volume при итоговом Docker-запуске; размер до 5 МиБ.
