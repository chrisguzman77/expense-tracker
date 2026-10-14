import pytest
from sqlalchemy import func, select

from app.models import Account, Category, Transaction, User


def signup(client, email):
    r = client.post(
        "/api/auth/register", json={"email": email, "password": "hunter22!"}
    )
    assert r.status_code == 201, r.text


def make_account(client, name="Wallet", account_type="cash"):
    r = client.post("/api/accounts", json={"name": name, "type": account_type})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def make_category(client, name="Food", **extra):
    r = client.post("/api/categories", json={"name": name, **extra})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def add(client, account_id, category_id, amount, on="2026-08-30", note=None):
    return client.post(
        "/api/transactions",
        json={
            "account_id": account_id,
            "category_id": category_id,
            "amount": amount,
            "occurred_on": on,
            "note": note,
        },
    )


def totals(client, year=2026, month=8):
    r = client.get(f"/api/summary?year={year}&month={month}")
    return {row["name"]: row["total"] for row in r.json()}


def test_transaction_includes_its_category_and_account(client):
    signup(client, "a@b.com")
    account = make_account(client)
    food = make_category(client)

    r = add(client, account, food, "-12.5", note="Lunch")

    assert r.status_code == 201, r.text
    txn = r.json()
    assert txn == {
        "id": txn["id"],
        "amount": "-12.50",
        "occurred_on": "2026-08-30",
        "note": "Lunch",
        "category": {
            "id": food,
            "name": "Food",
            "color": "slate",
            "icon": "🏷️",
            "kind": "spending",
        },
        "account": {"id": account, "name": "Wallet", "type": "cash"},
    }
    assert client.get("/api/transactions").json() == [txn]


def test_money_in_is_accepted(client):
    signup(client, "a@b.com")
    r = add(client, make_account(client), make_category(client), "20.00")
    assert r.status_code == 201, r.text
    assert r.json()["amount"] == "20.00"


@pytest.mark.parametrize("amount", ["0", "0.00", "-0"])
def test_zero_amount_is_rejected(client, amount):
    signup(client, "a@b.com")
    r = add(client, make_account(client), make_category(client), amount)
    assert r.status_code == 422


def test_user_cannot_see_or_delete_another_users_transaction(client):
    signup(client, "a@b.com")
    txn = add(client, make_account(client), make_category(client), "-12.5").json()
    client.post("/api/auth/logout")

    signup(client, "c@d.com")
    assert client.get("/api/transactions").json() == []
    r = client.delete(f"/api/transactions/{txn['id']}")
    assert r.status_code == 404
    assert r.json() == {"detail": "Transaction not found"}


def test_cannot_use_another_users_account_or_category(client):
    signup(client, "a@b.com")
    their_account = make_account(client)
    their_category = make_category(client)
    client.post("/api/auth/logout")

    signup(client, "c@d.com")
    my_account = make_account(client)
    my_category = make_category(client)

    r = add(client, their_account, my_category, "-1.00")
    assert r.status_code == 404
    assert r.json() == {"detail": "Account not found"}
    r = add(client, my_account, their_category, "-1.00")
    assert r.status_code == 404
    assert r.json() == {"detail": "Category not found"}


def test_list_filters_by_account(client):
    signup(client, "a@b.com")
    wallet = make_account(client, "Wallet")
    card = make_account(client, "Card", "credit_card")
    food = make_category(client)
    add(client, wallet, food, "-1.00")
    on_card = add(client, card, food, "-2.00").json()

    assert client.get(f"/api/transactions?account_id={card}").json() == [on_card]


def test_filtering_by_another_users_account_is_404(client):
    signup(client, "a@b.com")
    their_account = make_account(client)
    client.post("/api/auth/logout")

    signup(client, "c@d.com")
    r = client.get(f"/api/transactions?account_id={their_account}")
    assert r.status_code == 404
    assert r.json() == {"detail": "Account not found"}


def test_summary_groups_by_category_for_month(client):
    signup(client, "a@b.com")
    account = make_account(client)
    food = make_category(client, "Food")
    gas = make_category(client, "Gas")
    for cid, amt, d in [
        (food, "-10.00", "2026-08-01"),
        (food, "-5.25", "2026-08-20"),
        (gas, "-40.00", "2026-08-15"),
        (food, "-99.00", "2026-07-31"),
    ]:
        assert add(client, account, cid, amt, on=d).status_code == 201
    assert totals(client) == {"Food": "15.25", "Gas": "40.00"}


def test_summary_nets_refunds_within_a_category(client):
    signup(client, "a@b.com")
    account = make_account(client)
    clothes = make_category(client, "Clothes")
    add(client, account, clothes, "-50.00", on="2026-08-02")
    add(client, account, clothes, "20.00", on="2026-08-09")
    assert totals(client) == {"Clothes": "30.00"}


def test_summary_returns_a_negative_total_when_refunds_outweigh_spending(client):
    signup(client, "a@b.com")
    add(client, make_account(client), make_category(client, "Clothes"), "20.00")
    assert totals(client) == {"Clothes": "-20.00"}


def test_summary_includes_categories_with_no_transactions_that_month(client):
    signup(client, "a@b.com")
    account = make_account(client)
    food = make_category(client, "Food")
    make_category(client, "Travel")  # never used
    add(client, account, food, "-99.00", on="2026-07-31")
    assert totals(client) == {"Food": "0", "Travel": "0"}


def test_category_color_and_icon_round_trip(client):
    signup(client, "a@b.com")
    r = client.post(
        "/api/categories", json={"name": "Food", "color": "amber", "icon": "🍔"}
    )
    assert r.status_code == 201, r.text
    cat = r.json()
    assert cat == {
        "id": cat["id"],
        "name": "Food",
        "color": "amber",
        "icon": "🍔",
        "kind": "spending",
    }
    assert client.get("/api/categories").json() == [cat]

    txn = add(client, make_account(client), cat["id"], "-3.00").json()
    assert txn["category"] == cat


def test_category_color_and_icon_default_when_omitted(client):
    signup(client, "a@b.com")
    cat = client.post("/api/categories", json={"name": "Food"}).json()
    assert cat["color"] == "slate"
    assert cat["kind"] == "spending"
    assert cat["icon"] == "🏷️"


def test_category_accepts_multi_codepoint_emoji(client):
    signup(client, "a@b.com")
    r = client.post("/api/categories", json={"name": "Family", "icon": "👨‍👩‍👧"})
    assert r.status_code == 201, r.text
    assert r.json()["icon"] == "👨‍👩‍👧"


@pytest.mark.parametrize(
    "extra",
    [{"color": "chartreuse"}, {"icon": ""}, {"icon": "x" * 17}, {"kind": "savings"}],
)
def test_category_rejects_bad_color_or_icon(client, extra):
    signup(client, "a@b.com")
    r = client.post("/api/categories", json={"name": "Food", **extra})
    assert r.status_code == 422
    assert client.get("/api/categories").json() == []


def test_summary_includes_color_and_icon(client):
    signup(client, "a@b.com")
    food = make_category(client, "Food", color="amber", icon="🍔")
    add(client, make_account(client), food, "-10.00", on="2026-08-01")
    assert client.get("/api/summary?year=2026&month=8").json() == [
        {
            "category_id": food,
            "name": "Food",
            "color": "amber",
            "icon": "🍔",
            "total": "10.00",
        }
    ]


def test_deleting_a_category_with_transactions_is_409(client):
    signup(client, "a@b.com")
    food = make_category(client)
    add(client, make_account(client), food, "-1.00")
    r = client.delete(f"/api/categories/{food}")
    assert r.status_code == 409
    assert r.json() == {"detail": "Category has transactions"}


def test_deleting_a_user_removes_their_accounts_categories_and_transactions(client, db):
    # Transactions reference accounts and categories with ON DELETE RESTRICT,
    # which Postgres checks immediately; the user's cascade must still succeed.
    signup(client, "a@b.com")
    assert (
        add(client, make_account(client), make_category(client), "-5.00").status_code
        == 201
    )
    user = db.get(User, client.get("/api/auth/me").json()["id"])

    db.delete(user)
    db.flush()

    for model in (Account, Category, Transaction):
        assert db.scalar(select(func.count()).select_from(model)) == 0


def test_category_kind_round_trip(client):
    signup(client, "a@b.com")
    r = client.post("/api/categories", json={"name": "Paycheck", "kind": "income"})
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "income"
    assert client.get("/api/categories").json()[0]["kind"] == "income"


def test_summary_counts_only_spending_categories(client):
    signup(client, "a@b.com")
    account = make_account(client)
    food = make_category(client, "Food")
    paycheck = make_category(client, "Paycheck", kind="income")
    card_payment = make_category(client, "Card payment", kind="transfer")
    make_category(client, "Bonus", kind="income")  # unused: still excluded
    add(client, account, food, "-10.00", on="2026-08-03")
    add(client, account, paycheck, "2000.00", on="2026-08-01")
    add(client, account, card_payment, "-500.00", on="2026-08-05")
    assert totals(client) == {"Food": "10.00"}


def test_summary_orders_by_total_then_name(client):
    signup(client, "a@b.com")
    account = make_account(client)
    gas = make_category(client, "Gas")
    food = make_category(client, "Food")
    clothes = make_category(client, "Clothes")
    make_category(client, "Travel")  # unused: total 0
    make_category(client, "Books")  # unused: total 0, sorts before Travel by name
    add(client, account, gas, "-40.00", on="2026-08-02")
    add(client, account, food, "-10.00", on="2026-08-03")
    add(client, account, clothes, "20.00", on="2026-08-04")
    names = [r["name"] for r in client.get("/api/summary?year=2026&month=8").json()]
    assert names == ["Gas", "Food", "Books", "Travel", "Clothes"]
