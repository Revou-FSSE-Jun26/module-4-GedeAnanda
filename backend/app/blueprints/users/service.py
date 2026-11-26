from sqlalchemy import select

from app.extensions import db
from app.models import User


def normalize_email(email: str) -> str:
    """Emails are stored lowercase so ``A@x.com`` and ``a@x.com`` are one account."""
    return email.strip().lower()


def find_user_by_email(email: str) -> User | None:
    return db.session.scalar(select(User).where(User.email == normalize_email(email)))
