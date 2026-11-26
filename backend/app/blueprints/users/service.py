import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.exceptions import AppError
from app.extensions import db
from app.models import User

EMAIL_TAKEN = "Email is already in use"


def normalize_email(email: str) -> str:
    """Emails are stored lowercase so ``A@x.com`` and ``a@x.com`` are one account."""
    return email.strip().lower()


def find_user_by_email(email: str) -> User | None:
    return db.session.scalar(select(User).where(User.email == normalize_email(email)))


def get_current_user(user_id: uuid.UUID) -> User:
    user = db.session.get(User, user_id)
    if user is None:
        raise AppError(404, "User not found")
    return user


def update_user(user_id: uuid.UUID, data: dict) -> User:
    user = get_current_user(user_id)
    if "email" in data:
        email = normalize_email(data["email"])
        owner = find_user_by_email(email)
        if owner is not None and owner.id != user.id:
            raise AppError(409, EMAIL_TAKEN)
        user.email = email
    if "name" in data:
        user.name = data["name"]
    try:
        db.session.commit()
    except IntegrityError as error:
        # Another account took the email between the check and the commit.
        db.session.rollback()
        raise AppError(409, EMAIL_TAKEN) from error
    return user
