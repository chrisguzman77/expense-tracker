import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.main import app

TEST_URL = "postgresql+psycopg://app:app@localhost:5434/expenses_test"
engine = create_engine(TEST_URL)
TestingSession = sessionmaker(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def registration_open(monkeypatch):
    # Production defaults to closed; most tests sign up through the endpoint.
    monkeypatch.setattr(settings, "allow_registration", True)


@pytest.fixture
def db():
    conn = engine.connect()
    tx = conn.begin()
    session = TestingSession(bind=conn)
    yield session
    session.close()
    tx.rollback()
    conn.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
