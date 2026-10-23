FROM python:3.12.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONPATH=/app
WORKDIR /app
COPY requirements.lock ./
RUN python -m pip install --no-cache-dir -r requirements.lock
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini pyproject.toml ./
COPY scripts ./scripts
COPY tests ./tests
RUN groupadd --gid 10001 alfa && useradd --uid 10001 --gid alfa --no-create-home alfa \
    && mkdir -p /app/storage && chown alfa:alfa /app/storage
USER alfa
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
