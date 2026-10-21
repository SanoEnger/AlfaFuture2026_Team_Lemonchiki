"""Explicit one-off TEMPORARY SQLite bootstrap for isolated API development.

Not a migration. Not for production; Smirnov's Alembic owns PostgreSQL tables.
Run only with DATABASE_URL pointing to local sqlite file.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import DATABASE_URL, engine
from app.models import Base
from app.seeds import seed

if not DATABASE_URL.startswith('sqlite'):
    raise SystemExit('Refusing to create schema: this bootstrap is SQLite-only')

Base.metadata.create_all(engine)
seed()
print('Temporary local database prepared. Schema must NOT replace canonical Alembic migrations.')
