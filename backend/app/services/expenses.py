from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..models.expense import Category, Expense


class NotFound(Exception): ...


class CategoryInUse(Exception): ...


class NameTaken(Exception): ...


# categories
def list_categories(db: Session, user_id: int) -> list[Category]:
    return list(
        db.scalars(
            select(Category).where(Category.user_id == user_id).order_by(Category.name)
        )
    )


def create_category(db: Session, user_id: int, name: str) -> Category:
    cat = Category(user_id=user_id, name=name)
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
    in_use = db.scalar(select(func.count()).where(Expense.category_id == cat.id))
    if in_use:
        raise CategoryInUse()
    db.delete(cat)
    db.commit()


# expenses
def list_expenses(
    db: Session, user_id: int, start: date | None, end: date | None
) -> list[Expense]:
    q = (
        select(Expense)
        .where(Expense.user_id == user_id)
        .options(selectinload(Expense.category))
    )
    if start:
        q = q.where(Expense.spent_on >= start)
    if end:
        q = q.where(Expense.spent_on <= end)
    return list(db.scalars(q.order_by(Expense.spent_on.desc(), Expense.id.desc())))


def create_expense(db: Session, user_id: int, data) -> Expense:
    _owned_category(db, user_id, data.category_id)
    exp = Expense(user_id=user_id, **data.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


def delete_expense(db: Session, user_id: int, expense_id: int) -> None:
    exp = db.get(Expense, expense_id)
    if exp is None or exp.user_id != user_id:
        raise NotFound()
    db.delete(exp)
    db.commit()


def summary_by_category(db: Session, user_id: int, year: int, month: int):
    start = date(year, month, 1)
    end = date(year + (month == 12), (month % 12) + 1, 1)
    q = (
        select(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
        .join(Expense, Expense.category_id == Category.id, isouter=True)
        .where(Category.user_id == user_id)
        .where(
            (Expense.spent_on >= start) & (Expense.spent_on < end)
            | (Expense.id.is_(None))
        )
        .group_by(Category.id)
        .order_by(func.sum(Expense.amount).desc().nulls_last())
    )
    return [{"category_id": r[0], "name": r[1], "total": r[2]} for r in db.execute(q)]
