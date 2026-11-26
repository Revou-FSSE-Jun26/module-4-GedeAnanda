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


def require_member(user_id: uuid.UUID, board_id: uuid.UUID) -> BoardMember:
    """Return the caller's membership of the board.

    Raises ``AppError(404)`` for non-members, so the board's existence is not revealed.
    """
    membership = db.session.scalars(
        db.select(BoardMember).where(
            BoardMember.board_id == board_id, BoardMember.user_id == user_id
        )
    ).first()
    if membership is None:
        raise AppError(404, "Board not found")
    return membership


def require_admin(user_id: uuid.UUID, board_id: uuid.UUID) -> BoardMember:
    """Return the caller's membership if they are an admin of the board.

    Raises ``AppError(404)`` for non-members and ``AppError(403)`` for non-admin members.
    """
    membership = require_member(user_id, board_id)
    if membership.role != ROLE_ADMIN:
        raise AppError(403, "Only a board admin can do this")
    return membership
