import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from app.blueprints.columns.service import COLUMN_NOT_FOUND, get_column
from app.blueprints.labels import service as labels
from app.blueprints.notifications import service as notifications
from app.exceptions import AppError
from app.extensions import db
from app.models import Board, BoardColumn, BoardMember, Card
from app.models.base import utc_now
from app.models.card import active_cards
from app.utils.auth import ROLE_ADMIN, require_member
from app.utils.ordering import next_order, rebalance_if_needed

CARD_NOT_FOUND = "Card not found"


def list_cards(user_id: uuid.UUID, params: dict) -> list[Card]:
    """Active cards assigned to the user and/or on one board, optionally filtered by title."""
    query = (
        active_cards()
        .join(Card.column)
        .join(BoardColumn.board)
        .options(
            contains_eager(Card.column).contains_eager(BoardColumn.board),
            selectinload(Card.assignee),
            selectinload(Card.labels),
            selectinload(Card.checklist),
        )
        # Only boards the user still belongs to, even for cards assigned to them.
        .where(
            BoardColumn.board_id.in_(
                select(BoardMember.board_id).where(BoardMember.user_id == user_id)
            )
        )
        .order_by(Board.name, Board.id, BoardColumn.order, Card.order)
    )
    if "board_id" in params:
        require_member(user_id, params["board_id"])
        query = query.where(BoardColumn.board_id == params["board_id"])
    if "assignee" in params:
        query = query.where(Card.assignee_id == user_id)
    term = params.get("q", "").strip()
    if term:
        query = query.where(Card.title.ilike(f"%{escape_like(term)}%", escape="\\"))
    return db.session.scalars(query).all()


def create_card(user_id: uuid.UUID, column_id: uuid.UUID, data: dict) -> Card:
    column = get_column(column_id)
    require_member(user_id, column.board_id, COLUMN_NOT_FOUND)
    ensure_assignee_is_member(column.board_id, data["assignee_id"])

    last_order = db.session.scalar(
        active_cards().where(Card.column_id == column_id).with_only_columns(func.max(Card.order))
    )
    card = Card(
        column=column,
        title=data["title"],
        description=data["description"],
        assignee_id=data["assignee_id"],
        due_date=data["due_date"],
        priority=data["priority"],
        created_by=user_id,
        order=next_order(last_order),
        completed_at=utc_now() if column.is_done else None,
    )
    db.session.add(card)
    labels.set_card_labels(card, data["label_ids"])
    db.session.flush()  # the notification needs card.id
    notify_assignee(card, user_id)
    db.session.commit()
    return card


def update_card(user_id: uuid.UUID, card_id: uuid.UUID, data: dict) -> Card:
    card, _ = get_card_for_member(user_id, card_id)
    assignee_changed = "assignee_id" in data and data["assignee_id"] != card.assignee_id
    if assignee_changed:
        ensure_assignee_is_member(card.column.board_id, data["assignee_id"])

    # Labels live in their own table and are owned by the labels blueprint (guideline BE-09).
    label_ids = data.pop("label_ids", None)
    if label_ids is not None:
        labels.set_card_labels(card, label_ids)
    for field, value in data.items():
        setattr(card, field, value)
    if assignee_changed:
        notify_assignee(card, user_id)
    db.session.commit()
    return card


def soft_delete_card(user_id: uuid.UUID, card_id: uuid.UUID) -> uuid.UUID:
    card, membership = get_card_for_member(user_id, card_id)
    if membership.role != ROLE_ADMIN and card.created_by != user_id:
        raise AppError(403, "Only the card's creator or a board admin can delete it")
    card.deleted_at = utc_now()
    db.session.commit()
    return card_id


def move_card(user_id: uuid.UUID, card_id: uuid.UUID, data: dict) -> dict:
    """Move the card to a column and position, keeping ``completed_at`` in step with it."""
    card, _ = get_card_for_member(user_id, card_id)
    target = db.session.get(BoardColumn, data["column_id"])
    if target is None or target.board_id != card.column.board_id:
        raise AppError(400, "column_id: Not a column on this card's board")

    card.column = target
    card.order = data["order"]
    if not target.is_done:
        card.completed_at = None
    elif card.completed_at is None:
        card.completed_at = utc_now()

    siblings = db.session.scalars(active_cards().where(Card.column_id == target.id)).all()
    rebalanced = rebalance_if_needed(siblings)
    db.session.commit()
    return {
        "card": card,
        "rebalanced": rebalanced,
        "column_orders": sorted(siblings, key=lambda item: item.order) if rebalanced else [],
    }


def get_card_for_member(
    user_id: uuid.UUID, card_id: uuid.UUID, not_found: str = CARD_NOT_FOUND
) -> tuple[Card, BoardMember]:
    """Return an active card and the caller's membership of its board.

    A deleted card, an unknown card and a card on someone else's board all raise
    the same ``AppError(404)``. ``not_found`` is the message for a caller that
    asked for something inside the card (a comment).
    """
    card = db.session.scalar(
        active_cards().where(Card.id == card_id).options(joinedload(Card.column))
    )
    if card is None:
        raise AppError(404, not_found)
    membership = require_member(user_id, card.column.board_id, not_found)
    return card, membership


def ensure_assignee_is_member(board_id: uuid.UUID, assignee_id: uuid.UUID | None) -> None:
    if assignee_id is None:
        return
    is_member = db.session.scalar(
        select(BoardMember.id).where(
            BoardMember.board_id == board_id, BoardMember.user_id == assignee_id
        )
    )
    if is_member is None:
        raise AppError(400, "assignee_id: Must be a member of this board")


def notify_assignee(card: Card, actor_id: uuid.UUID) -> None:
    """N1: tell the assignee about the card, unless they assigned it to themselves."""
    if card.assignee_id is None or card.assignee_id == actor_id:
        return
    notifications.create_notification(
        card.assignee_id,
        "card_assigned",
        f"You were assigned to '{card.title}'",
        card_id=card.id,
        board_id=card.column.board_id,
    )


def escape_like(term: str) -> str:
    """Make ``%`` and ``_`` in a search term match literally (guideline DB-10)."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
