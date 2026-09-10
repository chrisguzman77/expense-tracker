def signup(client, email):
    r = client.post(
        "/api/auth/register", json={"email": email, "password": "hunter22!"}
    )
    assert r.status_code == 201, r.text


def test_user_cannot_see_or_delete_another_users_expense(client):
    signup(client, "a@b.com")
    cat = client.post("/api/categories", json={"name": "Food"}).json()
    exp = client.post(
        "/api/expenses",
        json={"category_id": cat["id"], "amount": "12.5", "spent_on": "2026-08-30"},
    ).json()
    client.post("/api/auth/logout")

    signup(client, "c@d.com")
    assert client.get("/api/expenses").json() == []
    assert client.delete(f"/api/expenses/{exp['id']}").status_code == 404
    r = client.post(
        "/api/expenses",
        json={"category_id": cat["id"], "amount": "1.00", "spent_on": "2026-08-30"},
    )
    assert r.status_code == 404


def test_summary_groups_by_category_for_month(client):
    signup(client, "a@b.com")
    food = client.post("/api/categories", json={"name": "Food"}).json()["id"]
    gas = client.post("/api/categories", json={"name": "Gas"}).json()["id"]
    for cid, amt, d in [
        (food, "10.00", "2026-08-01"),
        (food, "5.25", "2026-08-20"),
        (gas, "40.00", "2026-08-15"),
        (food, "99.00", "2026-07-31"),
    ]:
        client.post(
            "/api/expenses", json={"category_id": cid, "amount": amt, "spent_on": d}
        )
    totals = {
        row["name"]: row["total"]
        for row in client.get("/api/summary?year=2026&month=8").json()
    }
    assert totals == {"Food": "15.25", "Gas": "40.00"}


def test_negative_amount_rejected(client):
    signup(client, "a@b.com")
    cat = client.post("/api/categories", json={"name": "Food"}).json()["id"]
    r = client.post(
        "/api/expenses",
        json={"category_id": cat, "amount": "-1", "spent_on": "2026-08-30"},
    )
    assert r.status_code == 422
