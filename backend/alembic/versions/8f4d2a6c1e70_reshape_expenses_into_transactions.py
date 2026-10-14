"""reshape expenses into transactions

Revision ID: 8f4d2a6c1e70
Revises: 5e2b7c41a9d3
Create Date: 2026-10-14 12:40:02.351800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f4d2a6c1e70'
down_revision: Union[str, Sequence[str], None] = '5e2b7c41a9d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Expenses become signed transactions that belong to an account."""
    # Postgres keeps the old names of the sequence, constraints and index when
    # a table is renamed, so rename them too.
    op.rename_table("expenses", "transactions")
    op.execute("ALTER SEQUENCE expenses_id_seq RENAME TO transactions_id_seq")
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT expenses_pkey TO transactions_pkey"
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT expenses_user_id_fkey "
        "TO transactions_user_id_fkey"
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT expenses_category_id_fkey "
        "TO transactions_category_id_fkey"
    )
    op.alter_column("transactions", "spent_on", new_column_name="occurred_on")
    op.execute(
        "ALTER INDEX ix_expenses_user_spent_on RENAME TO ix_transactions_user_occurred_on"
    )

    # Every existing row moves into an account named "Cash". Accounts shipped
    # first, so a user may already have one by that name: reuse it.
    op.add_column("transactions", sa.Column("account_id", sa.Integer(), nullable=True))
    op.execute(
        "INSERT INTO accounts (user_id, name, type) "
        "SELECT DISTINCT user_id, 'Cash', 'cash' FROM transactions "
        "ON CONFLICT (user_id, name) DO NOTHING"
    )
    op.execute(
        "UPDATE transactions AS t SET account_id = a.id FROM accounts AS a "
        "WHERE a.user_id = t.user_id AND a.name = 'Cash'"
    )
    op.alter_column("transactions", "account_id", nullable=False)
    op.create_foreign_key(
        "transactions_account_id_fkey",
        "transactions",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_transactions_account_occurred_on",
        "transactions",
        ["account_id", "occurred_on"],
    )

    # Every existing row is money out, which is now negative.
    op.execute("UPDATE transactions SET amount = -amount")


def downgrade() -> None:
    """Back to expenses. Accounts are user data once created and stay; the
    accounts migration's downgrade drops that table. Lossy once money-in rows
    exist: they come back as negative expenses, which the old API rejects."""
    op.execute("UPDATE transactions SET amount = -amount")
    op.drop_index("ix_transactions_account_occurred_on", table_name="transactions")
    op.drop_constraint(
        "transactions_account_id_fkey", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "account_id")

    op.execute(
        "ALTER INDEX ix_transactions_user_occurred_on RENAME TO ix_expenses_user_spent_on"
    )
    op.alter_column("transactions", "occurred_on", new_column_name="spent_on")
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT transactions_category_id_fkey "
        "TO expenses_category_id_fkey"
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT transactions_user_id_fkey "
        "TO expenses_user_id_fkey"
    )
    op.execute(
        "ALTER TABLE transactions RENAME CONSTRAINT transactions_pkey TO expenses_pkey"
    )
    op.execute("ALTER SEQUENCE transactions_id_seq RENAME TO expenses_id_seq")
    op.rename_table("transactions", "expenses")
