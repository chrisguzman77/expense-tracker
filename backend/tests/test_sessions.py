from datetime import UTC, datetime, timedelta

import jwt

from app.auth import COOKIE_NAME
from app.config import Settings, settings

CREDS = {"email": "a@b.com", "password": "hunter22!"}


def decode(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def sign(**claims) -> str:
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def register(client) -> int:
    r = client.post("/api/auth/register", json=CREDS)
    assert r.status_code == 201
    client.cookies.clear()
    return r.json()["id"]


def me_with(client, token: str):
    # Send exactly this token, nothing left over in the client's cookie jar.
    client.cookies.clear()
    return client.get("/api/auth/me", headers={"Cookie": f"{COOKIE_NAME}={token}"})


def minutes_left(payload: dict) -> float:
    return (payload["exp"] - datetime.now(UTC).timestamp()) / 60


def soon() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=5)


REMEMBER_MINUTES = settings.remember_days * 24 * 60
REMEMBER_MAX_AGE = f"Max-Age={settings.remember_days * 86400}"


def test_remember_days_defaults_to_30():
    assert Settings.model_fields["remember_days"].default == 30


def test_login_without_remember_is_a_short_browser_session(client):
    register(client)
    r = client.post("/api/auth/login", json=CREDS)
    assert r.status_code == 200
    assert "Max-Age" not in r.headers["set-cookie"]
    payload = decode(r.cookies[COOKIE_NAME])
    assert payload["rm"] is False
    assert payload["ver"] == 0
    assert "iat" in payload
    assert abs(minutes_left(payload) - settings.jwt_expire_minutes) < 1


def test_login_with_remember_is_a_persistent_long_session(client):
    register(client)
    r = client.post("/api/auth/login", json={**CREDS, "remember": True})
    assert r.status_code == 200
    assert REMEMBER_MAX_AGE in r.headers["set-cookie"]
    payload = decode(r.cookies[COOKIE_NAME])
    assert payload["rm"] is True
    assert abs(minutes_left(payload) - REMEMBER_MINUTES) < 1


def test_register_starts_a_short_session(client):
    r = client.post("/api/auth/register", json=CREDS)
    assert r.status_code == 201
    assert decode(r.cookies[COOKIE_NAME])["rm"] is False


def test_remembered_session_slides_on_each_request(client):
    user_id = register(client)
    r = me_with(client, sign(sub=str(user_id), exp=soon(), ver=0, rm=True))
    assert r.status_code == 200
    assert REMEMBER_MAX_AGE in r.headers["set-cookie"]
    payload = decode(r.cookies[COOKIE_NAME])
    assert payload["rm"] is True
    assert payload["ver"] == 0
    assert abs(minutes_left(payload) - REMEMBER_MINUTES) < 1


def test_short_session_slides_without_becoming_persistent(client):
    user_id = register(client)
    r = me_with(client, sign(sub=str(user_id), exp=soon(), ver=0, rm=False))
    assert r.status_code == 200
    assert "Max-Age" not in r.headers["set-cookie"]
    payload = decode(r.cookies[COOKIE_NAME])
    assert payload["rm"] is False
    assert abs(minutes_left(payload) - settings.jwt_expire_minutes) < 1


def test_expired_token_is_401(client):
    user_id = register(client)
    expired = datetime.now(UTC) - timedelta(seconds=1)
    r = me_with(client, sign(sub=str(user_id), exp=expired, ver=0, rm=True))
    assert r.status_code == 401


def test_token_with_a_different_version_is_401(client):
    user_id = register(client)
    r = me_with(client, sign(sub=str(user_id), exp=soon(), ver=1, rm=True))
    assert r.status_code == 401


def test_token_without_a_version_is_401(client):
    # Tokens issued before this change have no ver claim.
    user_id = register(client)
    r = me_with(client, sign(sub=str(user_id), exp=soon()))
    assert r.status_code == 401


def test_log_out_everywhere_ends_every_session(client):
    register(client)
    first = client.post("/api/auth/login", json=CREDS).cookies[COOKIE_NAME]
    second = client.post("/api/auth/login", json=CREDS).cookies[COOKIE_NAME]
    client.cookies.clear()

    r = client.post(
        "/api/auth/logout-all", headers={"Cookie": f"{COOKIE_NAME}={second}"}
    )

    assert r.status_code == 204
    assert me_with(client, first).status_code == 401
    assert me_with(client, second).status_code == 401
    fresh = client.post("/api/auth/login", json=CREDS).cookies[COOKIE_NAME]
    assert decode(fresh)["ver"] == 1
    assert me_with(client, fresh).status_code == 200


def test_log_out_everywhere_requires_login(client):
    client.cookies.clear()
    assert client.post("/api/auth/logout-all").status_code == 401
