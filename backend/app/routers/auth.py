from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..auth import COOKIE_NAME, create_token, get_current_user
from ..config import settings
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin, UserRead
from ..services import users as user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


@router.post("/register", response_model=UserRead, status_code=201)
def register(body: UserCreate, response: Response, db: Session = Depends(get_db)):
    try:
        user = user_service.register(db, body.email, body.password)
    except user_service.EmailTaken:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    set_auth_cookie(response, create_token(user.id))
    return user


@router.post("/login", response_model=UserRead)
def login(body: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = user_service.authenticate(db, body.email, body.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    set_auth_cookie(response, create_token(user.id))
    return user


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
