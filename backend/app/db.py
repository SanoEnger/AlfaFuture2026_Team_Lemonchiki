"""SQLAlchemy session factory. Production schemas are migrated by Smirnov's Alembic."""
from collections.abc import Iterator
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg://alfa:alfa@localhost:5432/alfa')
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise
