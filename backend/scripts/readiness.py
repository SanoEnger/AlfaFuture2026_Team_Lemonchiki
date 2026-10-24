"""Container health: HTTP server, migrated database and seed are available."""
from urllib.request import urlopen
from sqlalchemy import text
from app.db import engine

with urlopen('http://127.0.0.1:8000/health', timeout=2) as response:
    assert response.status == 200
with engine.connect() as connection:
    assert connection.scalar(text('SELECT count(*) FROM alembic_version')) == 1
    assert connection.scalar(text("SELECT version_num FROM alembic_version")) == '0002'
    assert connection.scalar(text('SELECT count(*) FROM credit_products')) >= 2
