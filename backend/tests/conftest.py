from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.limiter import limiter
from app.core.security import hash_password
from app.core.streaming import get_session_factory
from app.main import app
from app.models.user import User as UserModel
from app.services.org_service import create_personal_organization

limiter.enabled = False

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_verified_user(email: str, password: str = "password123") -> None:
    """Insert a pre-verified user directly into the test DB."""
    db = TestingSessionLocal()
    try:
        user = UserModel(
            email=email, username=email.split("@")[0], hashed_password=hash_password(password), is_verified=True
        )
        db.add(user)
        db.flush()
        create_personal_organization(db, user)
        db.commit()
    finally:
        db.close()


def register_and_login(client: TestClient, email: str, password: str = "password123") -> dict:
    """Create a verified user and return Bearer auth headers."""
    create_verified_user(email, password)
    return login(client, email, password)


def login(client: TestClient, email: str, password: str = "password123") -> dict:
    """Log in an already-existing user and return Bearer auth headers."""
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db
app.dependency_overrides[get_session_factory] = lambda: TestingSessionLocal


@pytest.fixture(autouse=True)
def _setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _default_on_topic():
    """Chat tests exercise stream_chat_answer/stream_dashboard_answer directly and
    don't care about the is_on_topic gate in front of them — default it to "yes"
    everywhere so those tests don't need their own patch, and so none of them make
    a real Groq call. Tests that specifically cover the gate override this."""
    with (
        patch("app.routers.chat.is_on_topic", return_value=True),
        patch("app.routers.dashboard_chat.is_on_topic", return_value=True),
    ):
        yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
