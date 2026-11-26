import uuid

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
