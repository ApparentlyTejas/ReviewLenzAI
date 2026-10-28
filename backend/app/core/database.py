from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# SQLAlchemy 2.1 defaults a bare "postgresql://" URL to the psycopg (v3) driver,
# but this project only installs psycopg2-binary, so pin the driver explicitly.
_database_url = settings.database_url
if _database_url.startswith("postgresql://"):
    _database_url = _database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
elif _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql+psycopg2://", 1)

engine = create_engine(_database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
