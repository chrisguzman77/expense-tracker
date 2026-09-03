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
