from flask_jwt_extended import create_access_token
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.exceptions import AppError
from app.extensions import db
from app.models import User

EMAIL_TAKEN = "Email is already registered"
INVALID_CREDENTIALS = "Invalid email or password"


def normalize_email(email: str) -> str:
    """Emails are stored lowercase so ``A@x.com`` and ``a@x.com`` are one account."""
    return email.strip().lower()


def find_user_by_email(email: str) -> User | None:
    return db.session.scalar(select(User).where(User.email == normalize_email(email)))


def register_user(data: dict) -> User:
    if find_user_by_email(data["email"]) is not None:
        raise AppError(409, EMAIL_TAKEN)

    user = User(name=data["name"], email=normalize_email(data["email"]))
    user.set_password(data["password"])
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError as error:
        # Two registrations with the same email raced past the check above.
        db.session.rollback()
        raise AppError(409, EMAIL_TAKEN) from error
    return user


def login_user(data: dict) -> dict:
    user = find_user_by_email(data["email"])
    # Same message for an unknown email and a wrong password, so the API does
    # not reveal which emails are registered.
    if user is None or not user.check_password(data["password"]):
        raise AppError(401, INVALID_CREDENTIALS)

    return {"access_token": create_access_token(identity=str(user.id)), "user": user}
