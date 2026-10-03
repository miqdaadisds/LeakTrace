import os
import logging
from app.db.base_repo import BaseRepository
from app.db.sqlite_repo import SQLiteRepository

logger = logging.getLogger("leaktrace.db")

def get_repository() -> BaseRepository:
    """
    Factory function to instantiate the active persistence repository.
    Selects PostgresRepository if DATABASE_URL is configured (Connected / Cloud Mode).
    Falls back to SQLiteRepository if DATABASE_URL is absent (Offline / Local Mode).
    """
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        try:
            from app.db.postgres_repo import PostgresRepository
            logger.info("[Database] Connected Mode: Using PostgreSQL / Supabase repository.")
            repo = PostgresRepository(database_url=database_url)
            return repo
        except Exception as e:
            logger.error(f"[Database] Failed to initialize PostgreSQL repository: {e}. Falling back to SQLite.")

    db_path = os.environ.get("LEAKTRACE_DB", "leaktrace.db")
    logger.info(f"[Database] Offline/Local Mode: Using SQLite repository ({db_path}).")
    return SQLiteRepository(db_path=db_path)
