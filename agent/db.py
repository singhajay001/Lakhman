from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from agent.config import settings
from agent.models import Base

_engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(bind=_engine, future=True, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(_engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
