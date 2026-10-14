from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..models.transaction import Category, Transaction
from . import accounts


class NotFound(Exception): ...


class CategoryInUse(Exception): ...


class NameTaken(Exception): ...


class TransactionNotFound(Exception): ...


# categories
def list_categories(db: Session, user_id: int) -> list[Category]:
    return list(
        db.scalars(
            select(Category).where(Category.user_id == user_id).order_by(Category.name)
        )
    )


def create_category(
    db: Session, user_id: int, name: str, color: str, icon: str, kind: str
) -> Category:
    cat = Category(user_id=user_id, name=name, color=color, icon=icon, kind=kind)
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise NameTaken()
    db.refresh(cat)
    return cat


def _owned_category(db: Session, user_id: int, category_id: int) -> Category:
    cat = db.get(Category, category_id)
    if cat is None or cat.user_id != user_id:
        raise NotFound()
    return cat


def delete_category(db: Session, user_id: int, category_id: int) -> None:
    cat = _owned_category(db, user_id, category_id)
    in_use = db.scalar(select(func.count()).where(Transaction.category_id == cat.id))
    if in_use:
        raise CategoryInUse()
    db.delete(cat)
    db.commit()


# transactions
def list_transactions(
    db: Session,
    user_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None,
) -> list[Transaction]:
    q = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .options(selectinload(Transaction.category), selectinload(Transaction.account))
    )
    if account_id is not None:
        # Raises accounts.NotFound for someone else's account, rather than
        # answering with an empty list that hides a wrong id.
        accounts.get_owned_account(db, user_id, account_id)
        q = q.where(Transaction.account_id == account_id)
    if start:
        q = q.where(Transaction.occurred_on >= start)
    if end:
        q = q.where(Transaction.occurred_on <= end)
    return list(
        db.scalars(q.order_by(Transaction.occurred_on.desc(), Transaction.id.desc()))
    )


def create_transaction(db: Session, user_id: int, data) -> Transaction:
    accounts.get_owned_account(db, user_id, data.account_id)
    _owned_category(db, user_id, data.category_id)
    txn = Transaction(user_id=user_id, **data.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def _owned_transaction(db: Session, user_id: int, transaction_id: int) -> Transaction:
    txn = db.get(Transaction, transaction_id)
    if txn is None or txn.user_id != user_id:
        raise TransactionNotFound()
    return txn


def update_transaction(
    db: Session, user_id: int, transaction_id: int, data
) -> Transaction:
    txn = _owned_transaction(db, user_id, transaction_id)
    accounts.get_owned_account(db, user_id, data.account_id)
    _owned_category(db, user_id, data.category_id)
    for field, value in data.model_dump().items():
        setattr(txn, field, value)
    db.commit()
    db.refresh(txn)
    return txn


def delete_transaction(db: Session, user_id: int, transaction_id: int) -> None:
    txn = _owned_transaction(db, user_id, transaction_id)
    db.delete(txn)
    db.commit()


def summary_by_category(db: Session, user_id: int, year: int, month: int):
    start = date(year, month, 1)
    end = date(year + (month == 12), (month % 12) + 1, 1)
    # Money out is negative, so spending is minus the sum: refunds reduce it.
    spent = -func.sum(Transaction.amount)
    total = func.coalesce(spent, 0)
    q = (
        select(
            Category.id,
            Category.name,
            Category.color,
            Category.icon,
            total.label("total"),
        )
        # Date range lives in the ON clause so categories with no transactions
        # this month survive the outer join (a WHERE filter would drop them).
        .join(
            Transaction,
            (Transaction.category_id == Category.id)
            & (Transaction.occurred_on >= start)
            & (Transaction.occurred_on < end),
            isouter=True,
        )
        .where(Category.user_id == user_id, Category.kind == "spending")
        .group_by(Category.id)
        .order_by(total.desc(), Category.name)
    )
    return [
        {"category_id": r[0], "name": r[1], "color": r[2], "icon": r[3], "total": r[4]}
        for r in db.execute(q)
    ]
