from __future__ import annotations

import pytest


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Point the app at a throwaway SQLite file for the duration of a test."""
    import agent.db as db
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from agent.models import Base

    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", future=True)
    monkeypatch.setattr(db, "_engine", engine)
    monkeypatch.setattr(db, "SessionLocal", sessionmaker(bind=engine, future=True,
                                                         expire_on_commit=False))
    Base.metadata.create_all(engine)
    return engine
