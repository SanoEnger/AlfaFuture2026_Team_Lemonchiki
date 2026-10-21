# Backend REST API v0.1

Основание: раздел 8 ТЗ Альфа-хакатона 2026. Базовый префикс **`/api/v1`**. Каноническая схема для фронта в `openapi.json`. Только синтетические данные.

## Маршруты

| Метод | Путь | Роль | Назначение |
|---|---|---|---|
| POST | `/auth/demo-login` | публичный | Bearer токен демо-учётки |
| GET | `/products` | CLIENT | кредитные продукты |
| GET | `/business/me` | CLIENT | карточка компании |
| GET | `/news` | CLIENT | синтетические новости по отрасли/цели |
| GET | `/applications` | CLIENT | собственные заявки |
| POST | `/applications` | CLIENT | новый черновик |
| PATCH | `/applications/{id}` | CLIENT | изменить черновик |
| GET | `/applications/{id}` | CLIENT | статус, оффер, исходные условия |
| POST | `/applications/{id}/submit` | CLIENT | первая подача и проверки |
| POST | `/applications/{id}/documents` | CLIENT | PDF до 5 МиБ |
| POST | `/applications/{id}/resubmit` | CLIENT | ответ на уточнение + новый скоринг |
| GET | `/applications/{id}/history` | CLIENT | журнал событий |
| POST | `/applications/{id}/accept` | CLIENT | принять предложение |
| POST | `/applications/{id}/decline` | CLIENT | отклонить предложение |
| GET | `/bank/applications` | BANK_EMPLOYEE | банковская очередь `?status=UNDER_REVIEW` |
| GET | `/bank/applications/{id}` | BANK_EMPLOYEE | подробности, риск, документы |
| POST | `/bank/applications/{id}/request-info` | BANK_EMPLOYEE | запрос сведений |
| POST | `/bank/applications/{id}/decision` | BANK_EMPLOYEE | OFFERED/REJECTED |
| GET | `/bank/applications/{id}/documents/{doc_id}` | BANK_EMPLOYEE | просмотреть PDF (дополнение для кабинета банка) |

## Примеры JSON

### Создание черновика

```json
{
  "product_id": "<UUID из GET /products>",
  "amount": "400000.00",
  "term_months": 12,
  "purpose": "WORKING_CAPITAL",
  "company_financials": {
    "revenue": "1400000.00", "expenses": "650000.00",
    "debt_payment": "50000.00", "months_active": 48
  }
}
```

`POST /applications` возвращает `201` и объект:

```json
{
  "id": "<UUID>", "status": "DRAFT",
  "requested_terms": {
    "amount": "400000.00", "term_months": 12,
    "purpose": "WORKING_CAPITAL", "product_id": "<UUID>"
  },
  "company": {"id":"<UUID>", "inn":"7701234567", "legal_name":"ООО Демо-Пекарня", "form":"ООО", "industry":"FOOD", "months_active":48, "revenue":"1400000.00", "expenses":"650000.00", "debt_payment":"50000.00"},
  "updated_at":"2026-10-20T10:00:00Z",
  "next_action":"Заполните заявку и нажмите «Отправить»", "latest_offer":null
}
```

### Банковское предложение

```json
{"type":"OFFERED", "offered_amount":"350000.00", "offered_term_months":12, "offered_annual_rate":"17.50", "reason":"Предложение банка"}
```

Отказ: `{"type":"REJECTED", "reason":"Причина отказа"}`. Банк не меняет сумму/срок, первоначально запрошенные клиентом.

### Ответ клиента на запрос

```json
{
  "response_message": "Уточнил реквизиты и приложил PDF",
  "company_details": {"legal_name": "ООО Демо-Пекарня", "inn": "7701234567"},
  "company_financials": {"revenue":"1400000.00", "expenses":"650000.00", "debt_payment":"50000.00", "months_active":48}
}
```

Поля уточнения опциональны. Но нужно предоставить минимум один ответ: новый документ, сообщение или изменение данных. Для загрузки PDF используется `multipart/form-data`, поле `file`.

## Формат ошибок

```json
{"error_code":"INVALID_TRANSITION", "message":"Переход ... недопустим", "details":null}
```

- `401` UNAUTHORIZED: токен отсутствует или неверный.
- `403` FORBIDDEN: роль не имеет прав.
- `404` NOT_FOUND: объект не найден или принадлежит другому клиенту.
- `409` INVALID_TRANSITION / DUPLICATE_OPERATION: переход запрещён или операция уже выполнена.
- `422` VALIDATION_ERROR: неверная сумма, срок, формат PDF, отсутствующие обязательные параметры.

**Финансы:** десятичные строки, не `float`. **Время:** ISO 8601 UTC. **Авторизация:** `Authorization: Bearer <JWT>`. **Сценарий:** создать DRAFT, submit, посмотреть банк, предложить условия, accept, проверить историю.
