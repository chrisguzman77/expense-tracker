import pytest


def signup(client, email):
    r = client.post(
        "/api/auth/register", json={"email": email, "password": "hunter22!"}
    )
    assert r.status_code == 201, r.text


def test_create_and_list_accounts_ordered_by_name(client):
    signup(client, "a@b.com")
    r = client.post("/api/accounts", json={"name": "Wells Fargo", "type": "checking"})
    assert r.status_code == 201, r.text
    wells = r.json()
    assert wells == {"id": wells["id"], "name": "Wells Fargo", "type": "checking"}
    chase = client.post(
        "/api/accounts", json={"name": "Chase Freedom", "type": "credit_card"}
    ).json()

    assert client.get("/api/accounts").json() == [chase, wells]


def test_duplicate_account_name_is_409(client):
    signup(client, "a@b.com")
    body = {"name": "Wallet", "type": "cash"}
    assert client.post("/api/accounts", json=body).status_code == 201
    r = client.post("/api/accounts", json=body)
    assert r.status_code == 409
    assert r.json() == {"detail": "Account name taken"}
    # The failed insert's rollback must not discard the first account.
    assert [a["name"] for a in client.get("/api/accounts").json()] == ["Wallet"]


def test_two_users_can_use_the_same_account_name(client):
    body = {"name": "Wallet", "type": "cash"}
    signup(client, "a@b.com")
    assert client.post("/api/accounts", json=body).status_code == 201
    client.post("/api/auth/logout")
    signup(client, "c@d.com")
    assert client.post("/api/accounts", json=body).status_code == 201


@pytest.mark.parametrize(
    "body",
    [
        {"name": "Brokerage", "type": "brokerage"},
        {"name": "", "type": "cash"},
        {"name": "x" * 51, "type": "cash"},
        {"name": "No type"},
    ],
)
def test_bad_account_is_422(client, body):
    signup(client, "a@b.com")
    assert client.post("/api/accounts", json=body).status_code == 422
    assert client.get("/api/accounts").json() == []


def test_delete_account(client):
    signup(client, "a@b.com")
    account = client.post(
        "/api/accounts", json={"name": "Wallet", "type": "cash"}
    ).json()
    assert client.delete(f"/api/accounts/{account['id']}").status_code == 204
    assert client.get("/api/accounts").json() == []


def test_user_cannot_see_or_delete_another_users_account(client):
    signup(client, "a@b.com")
    account = client.post(
        "/api/accounts", json={"name": "Wallet", "type": "cash"}
    ).json()
    client.post("/api/auth/logout")

    signup(client, "c@d.com")
    assert client.get("/api/accounts").json() == []
    r = client.delete(f"/api/accounts/{account['id']}")
    assert r.status_code == 404
    assert r.json() == {"detail": "Account not found"}


def test_delete_missing_account_is_404(client):
    signup(client, "a@b.com")
    assert client.delete("/api/accounts/999999").status_code == 404


def test_accounts_require_login(client):
    assert client.get("/api/accounts").status_code == 401


def test_deleting_an_account_with_transactions_is_409(client):
    signup(client, "a@b.com")
    account = client.post(
        "/api/accounts", json={"name": "Wallet", "type": "cash"}
    ).json()
    food = client.post("/api/categories", json={"name": "Food"}).json()
    r = client.post(
        "/api/transactions",
        json={
            "account_id": account["id"],
            "category_id": food["id"],
            "amount": "-1.00",
            "occurred_on": "2026-08-30",
        },
    )
    assert r.status_code == 201, r.text

    r = client.delete(f"/api/accounts/{account['id']}")
    assert r.status_code == 409
    assert r.json() == {"detail": "Account has transactions"}


def test_edit_account_name_and_type(client):
    signup(client, "a@b.com")
    account = client.post(
        "/api/accounts", json={"name": "TOTAL CHECKING 1234", "type": "savings"}
    ).json()

    r = client.put(
        f"/api/accounts/{account['id']}",
        json={"name": "Chase checking", "type": "checking"},
    )

    assert r.status_code == 200, r.text
    edited = r.json()
    assert edited == {"id": account["id"], "name": "Chase checking", "type": "checking"}
    assert client.get("/api/accounts").json() == [edited]


def test_account_can_be_saved_under_its_own_name(client):
    signup(client, "a@b.com")
    account = client.post(
        "/api/accounts", json={"name": "Wallet", "type": "cash"}
    ).json()
    r = client.put(
        f"/api/accounts/{account['id']}", json={"name": "Wallet", "type": "checking"}
    )
    assert r.status_code == 200, r.text


def test_renaming_an_account_to_a_taken_name_is_409(client):
    signup(client, "a@b.com")
    client.post("/api/accounts", json={"name": "Wallet", "type": "cash"})
    card = client.post(
        "/api/accounts", json={"name": "Card", "type": "credit_card"}
    ).json()

    r = client.put(
        f"/api/accounts/{card['id']}", json={"name": "Wallet", "type": "credit_card"}
    )

    assert r.status_code == 409
    assert r.json() == {"detail": "Account name taken"}
    assert [a["name"] for a in client.get("/api/accounts").json()] == ["Card", "Wallet"]


def test_cannot_edit_another_users_account(client):
    signup(client, "a@b.com")
    account = client.post(
        "/api/accounts", json={"name": "Wallet", "type": "cash"}
    ).json()
    client.post("/api/auth/logout")

    signup(client, "c@d.com")
    r = client.put(
        f"/api/accounts/{account['id']}", json={"name": "Mine", "type": "cash"}
    )
    assert r.status_code == 404
    assert r.json() == {"detail": "Account not found"}
