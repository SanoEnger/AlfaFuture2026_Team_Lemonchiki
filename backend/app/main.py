import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router
from .errors import install_error_handlers

app = FastAPI(
    title='Alfa Hack 2026 | Smart Credit Backend',
    version='0.1.0',
    description='Автономный демонстрационный кредитный кабинет. Все проверки и выдача кредита являются симуляцией.',
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()],
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'PATCH', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type'],
)
install_error_handlers(app)
app.include_router(router)


@app.get('/health', tags=['system'])
def health():
    return {'status': 'ok', 'service': 'smart-credit-backend', 'demo': True}
