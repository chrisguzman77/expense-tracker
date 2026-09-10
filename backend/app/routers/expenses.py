from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..schemas.expense import *
from ..services import expenses as svc

router = APIRouter(prefix="/api", tags=["expenses"])


@router.get("/categories", response_model=list[CategoryRead])
def list_categories(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return svc.list_categories(db, user.id)


@router.post("/categories", response_model=CategoryRead, status_code=201)
def create_category(
    body: CategoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_category(db, user.id, body.name)
    except svc.NameTaken:
        raise HTTPException(status.HTTP_409_CONFLICT, "Category name taken")


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc.delete_category(db, user.id, category_id)
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    except svc.CategoryInUse:
        raise HTTPException(status.HTTP_409_CONFLICT, "Category has expenses")


@router.get("/expenses", response_model=list[ExpenseRead])
def list_expenses(
    start: date | None = None,
    end: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.list_expenses(db, user.id, start, end)


@router.post("/expenses", response_model=ExpenseRead, status_code=201)
def create_expense(
    body: ExpenseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_expense(db, user.id, body)
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not fund")


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expenses(
    expense_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc.delete_expense(db, user.id, expense_id)
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")


@router.get("/summary", response_model=list[CategorySummary])
def summary(
    year: int = Query(ge=2000),
    month: int = Query(ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.summary_by_category(db, user.id, year, month)
