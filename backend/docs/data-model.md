# База данных кредитного кабинета

Каноническая схема PostgreSQL для SM-01–SM-03. Источник моделей — `app/models.py`, начальная миграция — `alembic/versions/0001_canonical_credit_database.py`. API использует те же имена полей, что и до добавления миграций. Все данные демонстрационные.

## Запуск PostgreSQL и миграций

Команды PowerShell выполняются из `backend`. Нужны Python 3.12/3.13 и запущенный Docker Desktop. Если PostgreSQL уже работает локально, контейнер не нужен: укажите свою пустую базу в `DATABASE_URL` и перейдите к миграциям.

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
python -m pip install --no-build-isolation --no-deps -e .

# Выберите пароль для локальной демонстрационной БД.
$env:POSTGRES_PASSWORD = "LocalDemo2026!"
$env:POSTGRES_PORT = "5432"
docker compose -f compose.db.yml up -d --wait

$env:DATABASE_URL = "postgresql+psycopg://alfa:LocalDemo2026!@127.0.0.1:5432/alfa"
python -m alembic upgrade head
python -m app.seeds --scenarios
python -m alembic current
python -m alembic check

$env:APP_SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
uvicorn app.main:app --reload
```

`compose.db.yml` поднимает только БД. Полный Compose для UI/API остаётся зоной общей интеграции. Если 5432 занят, задайте `POSTGRES_PORT=5433` и поменяйте порт в `DATABASE_URL` и DBeaver. Пароль с особыми символами URL нужно кодировать при составлении `DATABASE_URL`. Переменные из `.env` автоматически читает Compose; для Python/Alembic их нужно задать в окружении оболочки.

`POSTGRES_PASSWORD` и остальные параметры инициализации применяются при первом создании volume. Их изменение не меняет пароль существующего PostgreSQL. Повторная команда `alembic upgrade head` безопасна. Существующую непустую БД нельзя просто помечать `stamp head`: сначала нужно проверить её соответствие миграции.

## Подключение через DBeaver

Создайте подключение типа **PostgreSQL** и заполните поля для приведённого выше Compose:

| Поле | Значение |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` или значение `POSTGRES_PORT` |
| Database | `alfa` |
| Username | `alfa` |
| Password | Значение `POSTGRES_PASSWORD` |
| Schema | `public` |

Нажмите **Test Connection**, при необходимости разрешите загрузить JDBC-драйвер PostgreSQL, затем **Finish**. После миграций в `Databases → alfa → Schemas → public → Tables` будут 11 таблиц приложения и `alembic_version`. После изменений схемы обновите дерево подключения. Для ER-диаграммы выберите таблицы и откройте ER Diagram: связи определяются по внешним ключам.

Демо-пароль пользователя приложения `Demo2026!` отличается от пароля подключения к PostgreSQL. Параметры подключения к установленному локально PostgreSQL зависят от его настройки.

## Схема отношений

```mermaid
erDiagram
    users ||--o{ companies : owner_user_id
    users ||--o{ loan_applications : applicant_id
    users ||--o{ credit_decisions : decided_by
    users o|--o{ application_events : actor_id
    companies ||--o{ loan_applications : company_id
    credit_products ||--o{ loan_applications : product_id
    loan_applications ||--o{ verification_results : application_id
    loan_applications ||--o{ risk_assessments : application_id
    loan_applications ||--o{ credit_decisions : application_id
    loan_applications ||--o{ information_requests : application_id
    loan_applications ||--o{ application_documents : application_id
    loan_applications ||--o{ application_events : application_id
    news_items {
        uuid id PK
        varchar title
        text body
        varchar target_industry
        varchar target_purpose
    }
```

У компании может быть несколько заявок. Новости независимы от заявок и подбираются по отрасли/цели. Связи заданы внешними ключами SQLAlchemy; загрузка связанных данных в существующем API выполняется явными запросами.

## Таблицы и поля

У всех 11 таблиц `id` типа UUID, первичный ключ. UUID генерируется приложением; при ручном SQL INSERT его нужно указать, например `gen_random_uuid()`. Все поля обязательны, кроме явно отмеченных ниже. Денежные суммы — `NUMERIC(16,2)`, ставки — `NUMERIC(6,2)`. В Python это `Decimal`, в API — десятичная строка.

| Таблица | Поля помимо id |
|---|---|
| `users` | `username VARCHAR(100)`, `password_hash TEXT`, `role VARCHAR(24)` |
| `companies` | `owner_user_id UUID FK`, `inn VARCHAR(12)`, `legal_name VARCHAR(255)`, `form VARCHAR(50)`, `industry VARCHAR(100)`, `months_active INTEGER`, `revenue`, `expenses`, `debt_payment` |
| `credit_products` | `code VARCHAR(50)`, `name VARCHAR(100)`, `purpose VARCHAR(100)`, `min_amount`, `max_amount`, `min_term INTEGER`, `max_term INTEGER`, `annual_rate` |
| `loan_applications` | `company_id UUID FK`, `applicant_id UUID FK`, `product_id UUID FK`, `requested_amount`, `term_months INTEGER`, `purpose VARCHAR(100)`, `financial_snapshot JSONB NULL`, `status VARCHAR(32)`, `version INTEGER`, `created_at`, `updated_at` |
| `verification_results` | `application_id UUID FK`, `check_type VARCHAR(32)`, `result JSONB`, `passed BOOLEAN`, `attempt_no INTEGER`, `created_at` |
| `risk_assessments` | `application_id UUID FK`, `score INTEGER`, `risk_level VARCHAR(16)`, `factors JSONB`, `factors_schema_version INTEGER`, `recommendation TEXT`, `rules_version VARCHAR(40)`, `input_snapshot JSONB`, `attempt_no INTEGER`, `created_at` |
| `credit_decisions` | `application_id UUID FK`, `decided_by UUID FK`, `type VARCHAR(20)`, `offer_amount NULL`, `offer_term INTEGER NULL`, `offer_rate NULL`, `reason TEXT`, `created_at` |
| `information_requests` | `application_id UUID FK`, `message TEXT`, `status VARCHAR(20)`, `created_at`, `resolved_at NULL` |
| `application_documents` | `application_id UUID FK`, `file_name VARCHAR(255)`, `storage_key TEXT`, `mime_type VARCHAR(100)`, `size_bytes INTEGER`, `created_at` |
| `application_events` | `application_id UUID FK`, `actor_id UUID FK NULL`, `from_status VARCHAR(32) NULL`, `to_status VARCHAR(32)`, `reason TEXT`, `occurred_at` |
| `news_items` | `title VARCHAR(255)`, `body TEXT`, `target_industry VARCHAR(100) NULL`, `target_purpose VARCHAR(100) NULL` |

Время — `TIMESTAMP WITH TIME ZONE`. Для времён создания и события задан серверный `now()`. Приложение передаёт время UTC; PostgreSQL/DBeaver могут отображать его в часовом поясе сессии. `updated_at` меняется через ORM и workflow; произвольный SQL UPDATE должен обновлять его явно.

## Ограничения и история

- Уникальны `users.username`, `companies.inn`, `credit_products.code`, `application_documents.storage_key`.
- ИНН содержит 10 или 12 ASCII-цифр; контрольная сумма для синтетических данных не проверяется.
- Финансовые показатели и возраст бизнеса неотрицательны. Сумма кредита и срок положительны. Границы продукта согласованы: максимум не меньше минимума; ставка неотрицательна.
- Роли: `CLIENT`, `BANK_EMPLOYEE`. Статусы заявки соответствуют workflow ТЗ. Балл — 0–100; риск — `LOW`, `MEDIUM`, `HIGH`.
- `version` заявки — номер попытки рассмотрения, начинается с 1. Это не счётчик оптимистической блокировки. `attempt_no >= 1`.
- На попытку заявки допускается один результат каждого типа проверки (`REGISTRY`, `BKI`) и одна оценка риска. Уникальности: `(application_id, attempt_no, check_type)` и `(application_id, attempt_no)`.
- Решение — `OFFERED` или `REJECTED`, причина непустая. При `OFFERED` обязательны положительные сумма/срок и неотрицательная ставка. При `REJECTED` все поля оффера пустые.
- Запрос уточнения — `OPEN` без даты закрытия или `RESOLVED` с датой не раньше создания.
- Документ — PDF размером 1–5 242 880 байт. В БД хранится путь, сам файл находится в файловом volume.
- Все внешние ключи используют `ON DELETE RESTRICT`: удаление компании, пользователя или заявки с зависимыми данными не уничтожает историю каскадом.

Исходные сумма/срок находятся в `loan_applications`, предложенные банком условия — только в `credit_decisions`. Новая попытка создаёт новые проверки и новую оценку. В `loan_applications.financial_snapshot` хранится текущий снимок, в каждой `risk_assessments.input_snapshot` — исторический снимок своей попытки. Снимки и результаты проверок содержат `schema_version`; версия структуры списка факторов хранится рядом в `factors_schema_version`, версия правил — в `rules_version`.

Проверка разрешённого перехода, прав/принадлежности, соответствия диапазону выбранного продукта и наличия актуального скоринга остаётся в backend. Обычный CHECK не может проверять другие таблицы. Заявка блокируется `SELECT ... FOR UPDATE`; статус, решение и событие записываются одной транзакцией. Прямое редактирование БД в DBeaver обходит эти бизнес-правила, поэтому сценарии демонстрации выполняются через API.

## Индексы

| Таблица | Индекс / назначение |
|---|---|
| `loan_applications` | `(company_id, created_at)` — заявки компании; `(applicant_id, created_at)` — список клиента; `(status, updated_at)` — очередь банка; `product_id` — связь с продуктом |
| `application_events` | `(application_id, occurred_at)` — история; `actor_id` — связь с пользователем |
| `credit_decisions` | `(application_id, created_at)` — последнее решение; `decided_by` — сотрудник |
| `verification_results` | Уникальный `(application_id, attempt_no, check_type)` — результаты попытки |
| `risk_assessments` | Уникальный `(application_id, attempt_no)` — версии оценки |
| `companies`, `information_requests`, `application_documents` | Индексы соответствующих внешних ключей |

Первичные и уникальные ключи также создают индексы. Отдельный индекс FK не дублируется, если его покрывает левый префикс составного/уникального индекса. GIN-индексы JSONB не добавлены: текущий API не фильтрует по содержимому JSON.

## Сиды и проверка

`python -m app.seeds` создаёт два продукта, двух клиентов, одного сотрудника, две компании и четыре новости. Логины: `client_good`, `client_risky`, `banker`; демо-пароль приложения: `Demo2026!`, в БД хранится PBKDF2-хеш. Сид добавляет отсутствующие записи, не сбрасывает пароли и изменения существующих профилей. Запускайте один экземпляр сидирования при инициализации.

`python -m app.seeds --scenarios` дополнительно создаёт три исторические заявки в `UNDER_REVIEW` с проверками, скорингом и журналом переходов. Скоринг Волосникова `volosnikov-rules-v1` даёт LOW (100), MEDIUM (66), HIGH (20); правила описаны в [scoring.md](scoring.md). Средний профиль использует отдельный исторический снимок компании, не меняя её текущие финансы. Уже сохранённые оценки не перезаписываются при смене правил.

```powershell
# Обычные тесты; PostgreSQL-проверки без отдельного URL пропускаются.
python -m pytest -q

# Для интеграционных тестов задайте отдельную тестовую БД.
# Пользователю тестов нужно право CREATE SCHEMA.
$env:DATABASE_TEST_URL = "postgresql+psycopg://alfa:LocalDemo2026!@127.0.0.1:5432/alfa_test"
python -m pytest -q
```

Тестовая база `alfa_test` должна существовать до запуска. Тесты создают и удаляют только собственные схемы `test_credit_<uuid>`, не таблицы `public`. Проверяются миграции вверх/вниз, соответствие ORM, JSONB, ограничения, сиды, создание/чтение заявки, повторная подача и оффер через API. При двух одновременных решениях одно завершается успешно, второе получает 409; в БД остаётся одно решение.

Для проверки сохранения данных создайте заявку в Swagger `http://127.0.0.1:8000/docs`, сохраните UUID, выполните `docker compose -f compose.db.yml restart db` и прочитайте её через GET после восстановления подключения. Именованный volume сохраняет данные при рестарте и обычном `down`; `down -v` удаляет volume.

Для резервной копии установленными клиентскими утилитами PostgreSQL:

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U alfa -d alfa -Fc -f alfa.backup
# Восстановление проверяйте в отдельной заранее созданной пустой БД.
pg_restore -h 127.0.0.1 -p 5432 -U alfa -d alfa_restore --no-owner alfa.backup
```

Пароль утилиты запрашивают отдельно. Миграции не заменяют резервную копию. `python -m alembic downgrade base` удаляет таблицы приложения: используйте только на отдельной одноразовой БД при проверке отката.
