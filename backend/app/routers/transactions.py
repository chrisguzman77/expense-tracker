from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..schemas.transaction import (
    CategoryCreate,
    CategoryRead,
    CategorySummary,
    TransactionCreate,
    TransactionRead,
)
from ..services import accounts as account_svc
from ..services import transactions as svc

router = APIRouter(prefix="/api", tags=["transactions"])


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
        return svc.create_category(db, user.id, body.name, body.color, body.icon)
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
        raise HTTPException(status.HTTP_409_CONFLICT, "Category has transactions")


@router.get("/transactions", response_model=list[TransactionRead])
def list_transactions(
    start: date | None = None,
    end: date | None = None,
    account_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.list_transactions(db, user.id, start, end, account_id)
    except account_svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")


@router.post("/transactions", response_model=TransactionRead, status_code=201)
def create_transaction(
    body: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_transaction(db, user.id, body)
    except account_svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc.delete_transaction(db, user.id, transaction_id)
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")


@router.get("/summary", response_model=list[CategorySummary])
def summary(
    year: int = Query(ge=2000),
    month: int = Query(ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.summary_by_category(db, user.id, year, month)
