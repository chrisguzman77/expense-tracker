from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.account import Account
from ..models.transaction import Transaction


class NotFound(Exception): ...


class NameTaken(Exception): ...


class AccountInUse(Exception): ...


def list_accounts(db: Session, user_id: int) -> list[Account]:
    return list(
        db.scalars(
            select(Account).where(Account.user_id == user_id).order_by(Account.name)
        )
    )


def create_account(db: Session, user_id: int, name: str, account_type: str) -> Account:
    account = Account(user_id=user_id, name=name, type=account_type)
    db.add(account)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise NameTaken()
    db.refresh(account)
    return account


def get_owned_account(db: Session, user_id: int, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        raise NotFound()
    return account


def delete_account(db: Session, user_id: int, account_id: int) -> None:
    account = get_owned_account(db, user_id, account_id)
    in_use = db.scalar(select(func.count()).where(Transaction.account_id == account.id))
    if in_use:
        raise AccountInUse()
    db.delete(account)
    db.commit()
