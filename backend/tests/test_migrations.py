"""The reshape migration moves existing rows, so it is tested against a real
database rather than trusted. Each test gets a fresh, empty database and drives
Alembic through its Python API."""

from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text

from alembic import command
from app.config import settings

SERVER = "postgresql+psycopg://app:app@localhost:5434"
DB_NAME = "expenses_migration_test"
BEFORE_RESHAPE = "5e2b7c41a9d3"  # create accounts
RESHAPE = "8f4d2a6c1e70"
ALEMBIC_DIR = Path(__file__).resolve().parents[1] / "alembic"


@pytest.fixture
def migration_db(monkeypatch):
    admin = create_engine(f"{SERVER}/expenses_test", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {DB_NAME} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {DB_NAME}"))
    admin.dispose()
    # alembic/env.py takes its URL from settings.
    monkeypatch.setattr(settings, "database_url", f"{SERVER}/{DB_NAME}")
    engine = create_engine(f"{SERVER}/{DB_NAME}")
    yield engine
    engine.dispose()


def migrate(step, revision):
    # No ini file: with one, env.py would reconfigure logging for the whole run.
    config = Config()
    config.set_main_option("script_location", str(ALEMBIC_DIR))
    step(config, revision)


def rows(engine, sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).all()


def constraint_names(engine, table):
    return [
        r.conname
        for r in rows(
            engine,
            "SELECT conname FROM pg_constraint "
            "WHERE conrelid = to_regclass(:t) ORDER BY conname",
            t=table,
        )
    ]


def add_user(conn, email):
    return conn.execute(
        text(
            "INSERT INTO users (email, hashed_password) VALUES (:e, 'x') RETURNING id"
        ),
        {"e": email},
    ).scalar_one()


def seed_expenses(engine):
    """One user with a category and two expenses; returns the user's id."""
    with engine.begin() as conn:
        user = add_user(conn, "a@b.com")
        food = conn.execute(
            text(
                "INSERT INTO categories (user_id, name) VALUES (:u, 'Food') RETURNING id"
            ),
            {"u": user},
        ).scalar_one()
        for amount in ("12.50", "3.00"):
            conn.execute(
                text(
                    "INSERT INTO expenses (user_id, category_id, amount, spent_on) "
                    "VALUES (:u, :c, :a, '2026-08-30')"
                ),
                {"u": user, "c": food, "a": amount},
            )
    return user


def test_reshape_moves_expenses_into_a_cash_account_and_flips_their_sign(
    migration_db,
):
    migrate(command.upgrade, BEFORE_RESHAPE)
    user = seed_expenses(migration_db)

    migrate(command.upgrade, RESHAPE)

    accounts = rows(migration_db, "SELECT id, user_id, name, type FROM accounts")
    assert [(a.user_id, a.name, a.type) for a in accounts] == [(user, "Cash", "cash")]
    txns = rows(
        migration_db,
        "SELECT account_id, amount, occurred_on FROM transactions ORDER BY id",
    )
    assert [(t.account_id, str(t.amount), str(t.occurred_on)) for t in txns] == [
        (accounts[0].id, "-12.50", "2026-08-30"),
        (accounts[0].id, "-3.00", "2026-08-30"),
    ]


def test_reshape_renames_everything_named_after_the_table(migration_db):
    migrate(command.upgrade, RESHAPE)

    assert rows(
        migration_db,
        "SELECT to_regclass('expenses') IS NULL, "
        "to_regclass('expenses_id_seq') IS NULL, "
        "to_regclass('ix_expenses_user_spent_on') IS NULL, "
        "to_regclass('transactions_id_seq') IS NOT NULL, "
        "to_regclass('ix_transactions_user_occurred_on') IS NOT NULL, "
        "to_regclass('ix_transactions_account_occurred_on') IS NOT NULL",
    ) == [(True, True, True, True, True, True)]
    assert constraint_names(migration_db, "transactions") == [
        "transactions_account_id_fkey",
        "transactions_category_id_fkey",
        "transactions_pkey",
        "transactions_user_id_fkey",
    ]


def test_downgrade_restores_expenses_and_upgrading_again_reuses_the_cash_account(
    migration_db,
):
    migrate(command.upgrade, BEFORE_RESHAPE)
    user = seed_expenses(migration_db)
    migrate(command.upgrade, RESHAPE)

    migrate(command.downgrade, BEFORE_RESHAPE)

    expenses = rows(migration_db, "SELECT amount, spent_on FROM expenses ORDER BY id")
    assert [(str(e.amount), str(e.spent_on)) for e in expenses] == [
        ("12.50", "2026-08-30"),
        ("3.00", "2026-08-30"),
    ]
    assert constraint_names(migration_db, "expenses") == [
        "expenses_category_id_fkey",
        "expenses_pkey",
        "expenses_user_id_fkey",
    ]
    assert rows(
        migration_db,
        "SELECT to_regclass('expenses_id_seq') IS NOT NULL, "
        "to_regclass('ix_expenses_user_spent_on') IS NOT NULL",
    ) == [(True, True)]
    # Accounts are user data once created: the downgrade keeps them.
    assert len(rows(migration_db, "SELECT id FROM accounts")) == 1

    migrate(command.upgrade, RESHAPE)

    accounts = rows(migration_db, "SELECT id FROM accounts WHERE user_id = :u", u=user)
    assert len(accounts) == 1
    assert {
        t.account_id for t in rows(migration_db, "SELECT account_id FROM transactions")
    } == {accounts[0].id}


def test_reshape_reuses_an_account_already_named_cash(migration_db):
    migrate(command.upgrade, BEFORE_RESHAPE)
    user = seed_expenses(migration_db)
    with migration_db.begin() as conn:
        existing = conn.execute(
            text(
                "INSERT INTO accounts (user_id, name, type) "
                "VALUES (:u, 'Cash', 'checking') RETURNING id"
            ),
            {"u": user},
        ).scalar_one()

    migrate(command.upgrade, RESHAPE)

    assert rows(migration_db, "SELECT id, type FROM accounts") == [
        (existing, "checking")
    ]
    assert {
        t.account_id for t in rows(migration_db, "SELECT account_id FROM transactions")
    } == {existing}


def test_reshape_creates_no_account_for_users_without_expenses(migration_db):
    migrate(command.upgrade, BEFORE_RESHAPE)
    with migration_db.begin() as conn:
        add_user(conn, "empty@b.com")

    migrate(command.upgrade, RESHAPE)

    assert rows(migration_db, "SELECT id FROM accounts") == []
