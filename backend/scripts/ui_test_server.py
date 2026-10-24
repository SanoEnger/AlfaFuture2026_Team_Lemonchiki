"""Disposable HTTP integration server. Never connects to the project database."""
import os
import secrets
from pathlib import Path
import sys
from uuid import uuid4
root = Path(__file__).resolve().parents[2]
folder = root / '.local' / ('api-ui-' + uuid4().hex)
folder.mkdir(parents=True)
os.environ['DATABASE_URL'] = 'sqlite+pysqlite:///' + (folder / 'test.sqlite').as_posix()
os.environ['APP_SECRET_KEY'] = secrets.token_urlsafe(48)
os.environ['UPLOAD_DIR'] = str(folder / 'documents')
os.environ['CORS_ORIGINS'] = 'http://127.0.0.1:5174,http://localhost:5174'
sys.path.insert(0, str(root / 'backend'))
from app.db import engine, SessionLocal
from app.models import Base
from app.seeds import seed
import uvicorn
Base.metadata.create_all(engine)  # Isolated synthetic test DB only.
with SessionLocal() as session:
    seed(session, include_scenarios=True)
    session.commit()
if __name__ == '__main__':
    uvicorn.run('app.main:app', host='127.0.0.1', port=8011, log_level='warning')
