from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details: object = None):
        self.code = code
        self.message = message
        self.status = status
        self.details = details


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status, content={'error_code': exc.code, 'message': exc.message, 'details': exc.details})

    @app.exception_handler(RequestValidationError)
    async def request_error_handler(request: Request, exc: RequestValidationError):
        # Errors may contain non-JSON-serializable objects, so reduce to public fields.
        details = [{'loc': list(item['loc']), 'msg': item['msg'], 'type': item['type']} for item in exc.errors()]
        return JSONResponse(status_code=422, content={'error_code': 'VALIDATION_ERROR', 'message': 'Некорректные входные данные', 'details': details})

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={'error_code': 'UNAUTHORIZED' if exc.status_code == 401 else 'FORBIDDEN' if exc.status_code == 403 else 'NOT_FOUND' if exc.status_code == 404 else 'HTTP_ERROR', 'message': str(exc.detail), 'details': None}, headers=exc.headers)
