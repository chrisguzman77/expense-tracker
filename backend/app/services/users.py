from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import hash_password, verify_password
from ..models.user import User


class EmailTaken(Exception): ...


def register(db: Session, email: str, password: str) -> User:
    if db.scalar(select(User).where(User.email == email)):
        raise EmailTaken()
    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user and verify_password(password, user.hashed_password):
        return user
    return None
