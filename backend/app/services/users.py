from sqlalchemy import select, update
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


def log_out_everywhere(db: Session, user: User) -> None:
    # Every token carries the version it was issued with, so incrementing the
    # version invalidates all of them at once.
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(token_version=User.token_version + 1)
    )
    db.commit()
