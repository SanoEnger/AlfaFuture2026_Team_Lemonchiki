import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router
from .api.frontend import router as frontend_router
from .api.identity import router as identity_router
from .errors import install_error_handlers

app = FastAPI(
    title='ФинМаршрут',
    version='0.1.0',
    description='Платформа кредитования бизнеса',
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PATCH', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', 'X-CSRF-Token', 'If-Match'],
)
install_error_handlers(app)
app.include_router(router)
app.include_router(frontend_router)
app.include_router(identity_router)


@app.get('/health', tags=['system'])
def health():
    return {'status': 'ok', 'service': 'finmarshrut'}
