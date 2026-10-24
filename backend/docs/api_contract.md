# ФинМаршрут — REST API

Платформа кредитования бизнеса. Базовый префикс: `/api/v1`. Полная актуальная схема: [openapi.json](../openapi.json). Фронтенд использует серверные данные и cookie-сеансы.

## Авторизация и аккаунты

Для команды сначала получить `GET /auth/csrf`, затем передать cookie и заголовок `X-CSRF-Token`. Браузер отправляет `credentials: include`. Cookie сеанса HttpOnly; значение токена авторизации в localStorage и sessionStorage не хранится.

| Метод | Путь | Назначение |
|---|---|---|
| GET | /auth/csrf | подписанный CSRF-токен |
| POST | /auth/register | регистрация CLIENT, письмо подтверждения |
| POST | /auth/verify-email | одноразовое подтверждение |
| POST | /auth/verify-email/resend | новое письмо |
| POST | /auth/login | email или прежний логин + пароль, cookie-сеанс |
| GET | /auth/me | роль, имя, email, статус настройки компании |
| POST | /auth/logout | отзыв сеанса, очистка cookie |
| POST | /auth/password/forgot | письмо восстановления |
| POST | /auth/password/reset | одноразовая смена пароля с отзывом сеансов |
| PATCH | /auth/profile | изменение имени |
| POST | /auth/password/change | текущий и новый пароль, отзыв сеансов |
| POST | /auth/invitations/inspect | проверка одноразового приглашения |
| POST | /auth/invitations/accept | активация BANK_OFFICER |

Первый BANK_ADMIN создаётся исключительно серверной командой `python -m app.manage create-admin`. Публичная регистрация не принимает роль.

## Бизнес и кредитные заявки

| Метод | Путь | Роль / назначение |
|---|---|---|
| GET | /catalog | все авторизованные роли, каталог |
| GET | /products | CLIENT, прежний каталог |
| POST | /organizations | CLIENT, первичная настройка компании |
| GET, PATCH | /business/me | CLIENT, собственная компания |
| GET | /news | CLIENT, материалы по отрасли/цели |
| GET, POST | /applications | CLIENT, свои заявки / создание черновика |
| GET, PATCH | /applications/{id} | CLIENT, карточка / изменение DRAFT |
| POST | /applications/{id}/submit | CLIENT, первая подача |
| POST | /applications/{id}/resubmit | CLIENT, ответ на запрос |
| GET | /applications/{id}/history | CLIENT, история |
| GET, POST | /applications/{id}/documents | CLIENT, список / PDF до 5 МиБ |
| GET | /applications/{id}/documents/{documentId}/download | CLIENT, скачивание своего файла |
| GET | /applications/{id}/information-requests | CLIENT, запросы сведений |
| POST | /applications/{id}/accept | CLIENT, принятие предложения |
| POST | /applications/{id}/decline | CLIENT, отказ от предложения |
| POST | /applications/{id}/complete | CLIENT, явное завершение после ACCEPTED |
| GET | /bank/applications | банковские роли, очередь |
| GET | /bank/applications/{id} | банковские роли, карточка с проверками и риском |
| GET | /bank/officers | банковские роли, ответственные сотрудники |
| POST | /bank/applications/{id}/claim | сотрудник, атомарно взять свободную заявку |
| POST | /bank/applications/{id}/assign | BANK_ADMIN, назначить активного сотрудника |
| POST | /bank/applications/{id}/request-info | назначенный сотрудник, запрос сведений |
| POST | /bank/applications/{id}/decision | назначенный сотрудник, OFFERED / REJECTED |
| GET | /bank/applications/{id}/documents/{documentId} | банковские роли, скачивание PDF |
| GET | /admin/staff | BANK_ADMIN, сотрудники |
| GET, POST | /admin/staff/invitations | BANK_ADMIN, список / приглашение |
| POST | /admin/staff/invitations/{id}/revoke | BANK_ADMIN, отзыв приглашения |
| POST | /admin/staff/{id}/suspend | BANK_ADMIN, блокировка и отзыв сеансов |
| POST | /admin/staff/{id}/reactivate | BANK_ADMIN, восстановление доступа |
| GET | /admin/audit | BANK_ADMIN, аудит |

BANK_ADMIN читает кредитные данные и управляет назначениями, но не принимает кредитные решения. BANK_EMPLOYEE сохранена для совместимости; новые приглашения создают BANK_OFFICER.

## Контракты и совместимость

Суммы и ставки передаются десятичными строками. Время — ISO 8601 UTC. `ApplicationResponse.version` — ревизия для оптимистической блокировки; команды могут передавать `expected_version`. Счётчик `loan_applications.version` в БД по-прежнему обозначает попытку проверок, новая колонка `revision` обслуживает блокировку.

Запрошенные условия отделены от предложения. Финансовый снимок отправленной заявки не изменяется при редактировании профиля компании. Чужая заявка возвращает 404. Блокировки строк предотвращают двойное назначение и конкурирующие решения.

Прежний JWT-маршрут и параметр автоматического завершения сохранены в OpenAPI для совместимости существующих клиентов. Новые экраны ими не авторизуются: используется `/auth/login`. Принятие в интерфейсе выполняется отдельно от `/complete`.

В обычном запуске проверяется формат сохранённых реквизитов, внешние реестр и БКИ не подключены. Их отсутствие отражается в JSON результата. Неподтверждённые сведения не дают положительных баллов; требуется ручное решение.

## Ошибки

```json
{"error_code":"INVALID_TRANSITION","message":"Переход недопустим","details":null}
```

401 — требуется вход; 403 — нет прав / неверный CSRF; 404 — объект не найден или чужой; 409 — конфликт состояния или ревизии; 422 — неверные поля; 429 — слишком много попыток; 503 — письмо не удалось отправить.
