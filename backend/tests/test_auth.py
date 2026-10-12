from sqlalchemy import func, select

from app.config import settings
from app.models.user import User


def test_register_sets_cookie_and_me_works(client):
    r = client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "hunter22!"}
    )
    assert r.status_code == 201
    assert "access_token" in r.cookies
    assert client.get("/api/auth/me").json()["email"] == "a@b.com"


def test_duplicate_email_is_409(client):
    body = {"email": "a@b.com", "password": "hunter22!"}
    client.post("/api/auth/register", json=body)
    assert client.post("/api/auth/register", json=body).status_code == 409


def test_wrong_password_is_401(client):
    client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "hunter22!"}
    )
    r = client.post("/api/auth/login", json={"email": "a@b.com", "password": "wrong"})
    assert r.status_code == 401


def test_me_without_cookie_is_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_register_is_403_when_registration_closed(client, db, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", False)
    r = client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "hunter22!"}
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "Registration is closed"}
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_existing_user_can_log_in_when_registration_closed(client, monkeypatch):
    body = {"email": "a@b.com", "password": "hunter22!"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    client.post("/api/auth/logout")
    monkeypatch.setattr(settings, "allow_registration", False)
    assert client.post("/api/auth/login", json=body).status_code == 200
    assert client.get("/api/auth/me").json()["email"] == "a@b.com"
