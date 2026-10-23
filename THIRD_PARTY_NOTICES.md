# Сторонние компоненты

Python-зависимости зафиксированы в `backend/requirements.lock`. Таблица составлена по метаданным установленных пакетов; тексты лицензий и уведомления правообладателей сохраняются в дистрибутивах пакетов внутри образа. Тестовые зависимости также устанавливаются в текущий демонстрационный образ.

| Пакет | Версия | Лицензия |
|---|---|---|
| alembic | 1.19.1 | MIT |
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| certifi | 2026.10.19 | MPL-2.0 |
| click | 8.5.0 | BSD-3-Clause |
| colorama | 0.4.6 | BSD |
| fastapi | 0.128.2 | MIT |
| greenlet | 3.5.6 | MIT AND PSF-2.0 |
| h11 | 0.16.0 | MIT |
| httpcore | 1.0.9 | BSD-3-Clause |
| httpx | 0.28.1 | BSD-3-Clause |
| idna | 3.20 | BSD-3-Clause |
| iniconfig | 2.3.1 | MIT |
| Mako | 1.4.3 | MIT |
| MarkupSafe | 3.0.4 | BSD-3-Clause |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pluggy | 1.7.0 | MIT |
| psycopg | 3.2.12 | LGPL-3.0-only |
| psycopg-binary | 3.2.12 | LGPL-3.0-only |
| pydantic | 2.13.5 | MIT |
| pydantic_core | 2.46.5 | MIT |
| Pygments | 2.21.0 | BSD-2-Clause |
| PyJWT | 2.13.0 | MIT |
| pytest | 9.0.2 | MIT |
| python-multipart | 0.0.29 | Apache-2.0 |
| setuptools | 84.2.1 | MIT |
| SQLAlchemy | 2.0.50 | MIT |
| starlette | 0.50.0 | BSD-3-Clause |
| typing-inspection | 0.4.4 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.5 | Apache-2.0 |
| uvicorn | 0.48.0 | BSD-3-Clause |

Setuptools указан по лицензии проекта; его локальная установка при составлении списка отсутствовала. Python в базовом образе распространяется под PSF License; PostgreSQL — под PostgreSQL License. Системные компоненты Debian и библиотеки из бинарных wheels сохраняют собственные уведомления в образах/дистрибутивах. Базовые образы: `python:3.12.12-slim`, `postgres:18.0`; теги зафиксированы, digest пока не зафиксирован.

Скоринг написан командой как детерминированная учебная балльная модель. Предобученные ML/LLM-модели, внешние датасеты, реальные кредитные истории и реальные банковские тарифы не используются. Реестр и БКИ полностью имитируются локальными модулями; новости и реквизиты компаний синтетические.
