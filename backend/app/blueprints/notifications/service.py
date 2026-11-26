import uuid

from sqlalchemy import func, select

from app.exceptions import AppError
from app.extensions import db
from app.models import Notification


def create_notification(
    recipient_id: uuid.UUID,
    type: str,
    message: str,
    *,
    card_id: uuid.UUID | None = None,
    board_id: uuid.UUID | None = None,
) -> Notification:
    """Add a notification to the current transaction.

    The only place a ``Notification`` is built (guideline BE-09). It does not
    commit: the calling service commits it together with its own change (DB-08).
    The caller must not pass the user who performed the action.
    """
    notification = Notification(
        user_id=recipient_id, type=type, message=message, card_id=card_id, board_id=board_id
    )
    db.session.add(notification)
    return notification


def list_notifications(user_id: uuid.UUID, params: dict) -> dict:
    """One page of the user's notifications, newest first, with the unread total."""
    mine = Notification.user_id == user_id
    page, per_page = params["page"], params["per_page"]
    items = db.session.scalars(
        select(Notification)
        .where(mine)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(per_page)
        .offset((page - 1) * per_page)
    ).all()
    total, unread_count = db.session.execute(
        select(
            func.count(),
            func.count().filter(Notification.is_read.is_(False)),
        ).where(mine)
    ).one()
    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": total,
        "unread_count": unread_count,
    }


def mark_as_read(user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    notification = db.session.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    if notification is None:
        # Same answer for an unknown ID and for someone else's notification.
        raise AppError(404, "Notification not found")
    notification.is_read = True
    db.session.commit()
    return notification
