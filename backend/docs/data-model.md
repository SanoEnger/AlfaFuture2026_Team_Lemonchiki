# Модель данных ФинМаршрут

Источник истины для структуры — app/models.py и миграции Alembic. Схема применяется через alembic upgrade head; приложение не создаёт таблицы при запуске API.

PostgreSQL разворачивается корневым compose.yml и доступен внутренним сервисам Docker. Консоль администратора:

~~~powershell
docker compose exec db psql -U alfa -d alfa
~~~

## Таблицы

| Таблица | Назначение |
|---|---|
| users | Клиенты, сотрудники, администраторы, состояние и хеш пароля |
| companies | Компания владельца и финансовый профиль |
| credit_products | Каталог продуктов и диапазоны условий |
| loan_applications | Заявки, исходные параметры, снимок, ответственный и ревизия |
| verification_results | Результаты каждой попытки проверок |
| risk_assessments | Балл, факторы, риск и версия правил |
| credit_decisions | Предложения и отказы сотрудников |
| information_requests | Запросы сведений и их разрешение |
| application_documents | Метаданные PDF и ключ в хранилище |
| application_events | История изменений заявки |
| auth_sessions | Хеши сеансов, срок действия и отзыв |
| identity_tokens | Одноразовые подтверждения, восстановления и приглашения |
| audit_events | Журнал управления доступом |
| news_items | Материалы для бизнеса |

~~~mermaid
erDiagram
    users ||--o{ companies : owns
    users ||--o{ loan_applications : submits
    users ||--o{ auth_sessions : authenticates
    users o|--o{ identity_tokens : confirms
    users o|--o{ audit_events : acts
    companies ||--o{ loan_applications : applies
    credit_products ||--o{ loan_applications : defines
    loan_applications ||--o{ verification_results : checks
    loan_applications ||--o{ risk_assessments : evaluates
    loan_applications ||--o{ credit_decisions : decides
    loan_applications ||--o{ information_requests : clarifies
    loan_applications ||--o{ application_documents : attaches
    loan_applications ||--o{ application_events : records
~~~

## Ограничения

Идентификаторы — UUID. Денежные значения — NUMERIC(16,2), ставки — NUMERIC(6,2); API передаёт десятичные строки. Время хранится с часовым поясом, API возвращает UTC.

Внешние ключи защищают связанные записи от потери. CHECK-ограничения проверяют роли, статусы, формат ИНН и допустимые финансовые значения. SQLAlchemy и API дополнительно проверяют принадлежность, диапазон продукта и разрешённые переходы.

loan_applications.version — номер попытки проверок; revision — ревизия для конкурентных изменений. Ответственный сотрудник хранится отдельно от автора заявки. Финансовый снимок отправленной заявки не заменяется текущими данными компании.

## Миграции и начальная загрузка

0001 создаёт кредитную схему. 0002 добавляет серверные аккаунты, сеансы, одноразовые токены, аудит, назначения, ревизии и комментарии. Обратная миграция защищает заполненные новые поля от удаления.

Начальная загрузка app.bootstrap создаёт только продукты и материалы, без пользователей и заявок. Изолированные тесты создают собственные временные схемы; тестовые фикстуры не загружаются в рабочую схему.
