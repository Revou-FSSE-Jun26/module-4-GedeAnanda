"""Identity and board-authorization helpers (guidelines BE-06, BE-07, BE-11)."""

import uuid

from flask_jwt_extended import get_jwt_identity

from app.exceptions import AppError
from app.extensions import db
from app.models.board_member import BoardMember

ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"


def current_user_id() -> uuid.UUID:
    """Return the caller's user ID from the JWT. Call only inside ``@jwt_required()`` routes."""
    return uuid.UUID(get_jwt_identity())


BOARD_NOT_FOUND = "Board not found"


def require_member(
    user_id: uuid.UUID, board_id: uuid.UUID, not_found: str = BOARD_NOT_FOUND
) -> BoardMember:
    """Return the caller's membership of the board.

    Raises ``AppError(404)`` for non-members, so the board's existence is not revealed.
    ``not_found`` is the message to use when the caller asked for something inside
    the board (a column, a card): it must match the message for a missing item.
    """
    membership = db.session.scalars(
        db.select(BoardMember).where(
            BoardMember.board_id == board_id, BoardMember.user_id == user_id
        )
    ).first()
    if membership is None:
        raise AppError(404, not_found)
    return membership


def require_admin(
    user_id: uuid.UUID, board_id: uuid.UUID, not_found: str = BOARD_NOT_FOUND
) -> BoardMember:
    """Return the caller's membership if they are an admin of the board.

    Raises ``AppError(404)`` for non-members and ``AppError(403)`` for non-admin members.
    """
    membership = require_member(user_id, board_id, not_found)
    if membership.role != ROLE_ADMIN:
        raise AppError(403, "Only a board admin can do this")
    return membership
