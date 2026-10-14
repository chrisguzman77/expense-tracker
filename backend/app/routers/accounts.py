from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..schemas.account import AccountCreate, AccountRead
from ..services import accounts as svc

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
def list_accounts(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return svc.list_accounts(db, user.id)


@router.post("", response_model=AccountRead, status_code=201)
def create_account(
    body: AccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_account(db, user.id, body.name, body.type)
    except svc.NameTaken:
        raise HTTPException(status.HTTP_409_CONFLICT, "Account name taken")


@router.delete("/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc.delete_account(db, user.id, account_id)
    except svc.NotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
