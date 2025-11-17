from sqlmodel import SQLModel, create_engine, Session

from .config import settings

engine = create_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_schema(engine)


def get_session() -> Session:
    with Session(engine) as session:
        yield session


def _ensure_schema(engine) -> None:
    """Ensure the database schema contains newly added columns.

    This runs simple SQLite 'ALTER TABLE' commands to add new columns that may
    be missing from older DBs created before the model was updated.
    """
    # Only applicable to SQLite for now
    from sqlalchemy import text
    with engine.begin() as conn:
        # Only proceed if table exists. Otherwise create_all will handle creation.
        res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='conversionjob'"))
        row = res.fetchone()
        if not row:
            return
        # Inspect existing columns
        res = conn.execute(text("PRAGMA table_info('conversionjob')"))
        existing = {r[1] for r in res}
        # Add missing columns as needed
        if 'artifact_path' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN artifact_path TEXT"))
        if 'artifact_mime_type' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN artifact_mime_type TEXT"))
        if 'stored_at' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN stored_at TIMESTAMP"))
        # Add original-related columns
        if 'original_path' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN original_path TEXT"))
        if 'original_mime_type' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN original_mime_type TEXT"))
        if 'share_token' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN share_token TEXT"))
        if 'share_token_expires_at' not in existing:
            conn.execute(text("ALTER TABLE conversionjob ADD COLUMN share_token_expires_at TIMESTAMP"))
