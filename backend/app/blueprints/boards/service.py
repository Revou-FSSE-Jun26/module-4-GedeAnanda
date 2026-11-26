import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import contains_eager, joinedload, selectinload
from sqlalchemy.orm.attributes import set_committed_value

from app.blueprints.notifications import service as notifications
from app.blueprints.users.service import find_user_by_email
from app.exceptions import AppError
from app.extensions import db
from app.models import Board, BoardColumn, BoardMember, Card
from app.utils.auth import ROLE_ADMIN, require_admin, require_member

ALREADY_MEMBER = "User is already a member of this board"


# --- Boards ------------------------------------------------------------------


def create_board(user_id: uuid.UUID, data: dict) -> BoardMember:
    """Create a board and make its creator the first admin, in one transaction."""
    board = Board(name=data["name"], owner_id=user_id)
    membership = BoardMember(board=board, user_id=user_id, role=ROLE_ADMIN)
    db.session.add_all([board, membership])
    db.session.commit()
    return membership


def list_boards(user_id: uuid.UUID) -> list[BoardMember]:
    """Return the user's memberships, each with its board loaded in the same query."""
    return db.session.scalars(
        select(BoardMember)
        .join(BoardMember.board)
        .options(contains_eager(BoardMember.board))
        .where(BoardMember.user_id == user_id)
        .order_by(Board.created_at, Board.id)
    ).all()


def get_board(user_id: uuid.UUID, board_id: uuid.UUID) -> BoardMember:
    """Return the membership with the board's columns and active cards loaded eagerly.

    The number of queries is fixed, whatever the number of columns and cards.
    """
    membership = require_member(user_id, board_id)
    board = db.session.scalars(
        select(Board)
        .where(Board.id == board_id)
        .options(
            selectinload(Board.columns)
            .selectinload(BoardColumn.cards.and_(Card.deleted_at.is_(None)))
            .selectinload(Card.assignee)
        )
        # Replace collections already in the session, so the deleted-card filter always applies.
        .execution_options(populate_existing=True)
    ).one()
    # Keep the loaded board attached to the result. The session only holds weak
    # references, so a board nobody points at is discarded and loaded again lazily.
    set_committed_value(membership, "board", board)
    return membership


def rename_board(user_id: uuid.UUID, board_id: uuid.UUID, data: dict) -> BoardMember:
    membership = require_admin(user_id, board_id)
    membership.board.name = data["name"]
    db.session.commit()
    return membership


def delete_board(user_id: uuid.UUID, board_id: uuid.UUID) -> uuid.UUID:
    """Hard-delete the board; its members, columns, cards and comments go with it."""
    membership = require_admin(user_id, board_id)
    db.session.delete(membership.board)
    db.session.commit()
    return board_id


# --- Members -----------------------------------------------------------------


def list_members(user_id: uuid.UUID, board_id: uuid.UUID) -> list[BoardMember]:
    require_member(user_id, board_id)
    return db.session.scalars(
        select(BoardMember)
        .where(BoardMember.board_id == board_id)
        .options(joinedload(BoardMember.user))
        .order_by(BoardMember.created_at, BoardMember.id)
    ).all()


def add_member(user_id: uuid.UUID, board_id: uuid.UUID, data: dict) -> BoardMember:
    admin = require_admin(user_id, board_id)
    user = find_user_by_email(data["email"])
    if user is None:
        raise AppError(404, "No user is registered with that email")
    if find_membership(board_id, user.id) is not None:
        raise AppError(409, ALREADY_MEMBER)

    membership = BoardMember(board_id=board_id, user=user, role=data["role"])
    db.session.add(membership)
    notifications.create_notification(
        user.id,
        "board_invite",
        f"You were added to the board '{admin.board.name}'",
        board_id=board_id,
    )
    try:
        db.session.commit()
    except IntegrityError as error:
        # The same user was added twice at the same moment.
        db.session.rollback()
        raise AppError(409, ALREADY_MEMBER) from error
    return membership


def update_member_role(
    user_id: uuid.UUID, board_id: uuid.UUID, target_user_id: uuid.UUID, data: dict
) -> BoardMember:
    require_admin(user_id, board_id)
    target = get_target_membership(board_id, target_user_id)
    if target.role == ROLE_ADMIN and data["role"] != ROLE_ADMIN:
        ensure_another_admin(board_id)
    target.role = data["role"]
    db.session.commit()
    return target


def remove_member(user_id: uuid.UUID, board_id: uuid.UUID, target_user_id: uuid.UUID) -> uuid.UUID:
    require_admin(user_id, board_id)
    target = get_target_membership(board_id, target_user_id)
    if target.role == ROLE_ADMIN:
        ensure_another_admin(board_id)
    db.session.delete(target)
    db.session.commit()
    return target_user_id


def find_membership(board_id: uuid.UUID, user_id: uuid.UUID) -> BoardMember | None:
    return db.session.scalar(
        select(BoardMember).where(
            BoardMember.board_id == board_id, BoardMember.user_id == user_id
        )
    )


def get_target_membership(board_id: uuid.UUID, target_user_id: uuid.UUID) -> BoardMember:
    target = find_membership(board_id, target_user_id)
    if target is None:
        raise AppError(404, "Member not found")
    return target


def ensure_another_admin(board_id: uuid.UUID) -> None:
    """Raise 400 if the board has only one admin, who is about to lose that role."""
    admin_count = db.session.scalar(
        select(func.count())
        .select_from(BoardMember)
        .where(BoardMember.board_id == board_id, BoardMember.role == ROLE_ADMIN)
    )
    if admin_count <= 1:
        raise AppError(400, "A board must keep at least one admin")
