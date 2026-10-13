from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models.user import User

COOKIE_NAME = "access_token"


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode(), hashed.encode())


def session_lifetime(remember: bool) -> timedelta:
    if remember:
        return timedelta(days=settings.remember_days)
    return timedelta(minutes=settings.jwt_expire_minutes)


def create_token(user: User, remember: bool) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + session_lifetime(remember),
        "ver": user.token_version,
        "rm": remember,
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def start_session(response: Response, user: User, remember: bool) -> None:
    # A remembered session gets a persistent cookie. Otherwise the cookie lasts
    # until the browser closes and the token's exp is the idle limit.
    max_age = int(session_lifetime(remember).total_seconds()) if remember else None
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_token(user, remember),
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=max_age,
        path="/",
    )


def get_current_user(
    request: Request, response: Response, db: Session = Depends(get_db)
) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not Authenticated")
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "ver", "rm"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired")
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    if payload["ver"] != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session ended")
    # Sliding window: every authenticated request pushes the expiry forward.
    start_session(response, user, remember=payload["rm"] is True)
    return user
