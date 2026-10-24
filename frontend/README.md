# ФинМаршрут — frontend

Платформа кредитования бизнеса. React + TypeScript + Vite + Mantine. Данные и авторизация поступают из FastAPI; PostgreSQL и файловое хранилище запускаются из корня проекта:

```powershell
docker compose up --build -d --wait
```

Для разработки интерфейса при работающем API на порту 8000:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Vite проксирует /api на http://127.0.0.1:8000. Открывайте приложение через http://localhost:5173. Не запускайте контейнер frontend и Vite на одном порту одновременно.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run generate:api
```

E2E использует отдельные порты 5174 и 8011 и изолированную тестовую БД. Нужен установленный Chromium для Playwright (`npx.cmd playwright install chromium`).

Бренд задаётся в shared/brand.ts, favicon — public/favicon.svg. Сохранены Graphite Glow, Pearl Light, IBM Plex Sans, красные акценты, Expandable Icon Rail и Hybrid AI Assistant 2.0.
