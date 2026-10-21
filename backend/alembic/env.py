"""Migration environment. Import metadata only, never the application engine."""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.models import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata


def database_url():
    # Environment wins; a programmatic URL makes isolated tests possible.
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    if not url:
        raise RuntimeError("Set DATABASE_URL before running Alembic")
    return url


if context.is_offline_mode():
    context.configure(url=database_url(), target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"},
                      compare_type=True, compare_server_default=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    # Reuse a caller's connection for migration tests when provided.
    connection = config.attributes.get("connection")
    if connection is not None:
        context.configure(connection=connection, target_metadata=target_metadata,
                          compare_type=True, compare_server_default=True)
        with context.begin_transaction():
            context.run_migrations()
    else:
        engine = create_engine(database_url(), poolclass=pool.NullPool)
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata,
                              compare_type=True, compare_server_default=True)
            with context.begin_transaction():
                context.run_migrations()
        engine.dispose()
