import uuid

from sqlalchemy import func, select

from app.blueprints.cards.service import get_card_for_member
from app.exceptions import AppError
from app.extensions import db
from app.models import ChecklistItem
from app.utils.ordering import next_order

ITEM_NOT_FOUND = "Checklist item not found"


def add_item(user_id: uuid.UUID, card_id: uuid.UUID, data: dict) -> ChecklistItem:
    card, _ = get_card_for_member(user_id, card_id)
    last_order = db.session.scalar(
        select(func.max(ChecklistItem.order)).where(ChecklistItem.card_id == card.id)
    )
    item = ChecklistItem(card_id=card.id, text=data["text"], order=next_order(last_order))
    db.session.add(item)
    db.session.commit()
    return item


def update_item(user_id: uuid.UUID, item_id: uuid.UUID, data: dict) -> ChecklistItem:
    item = get_item_for_member(user_id, item_id)
    for field, value in data.items():
        setattr(item, field, value)
    db.session.commit()
    return item


def delete_item(user_id: uuid.UUID, item_id: uuid.UUID) -> uuid.UUID:
    item = get_item_for_member(user_id, item_id)
    db.session.delete(item)
    db.session.commit()
    return item_id


def get_item_for_member(user_id: uuid.UUID, item_id: uuid.UUID) -> ChecklistItem:
    """Return an item on an active card of a board the caller belongs to.

    An unknown item, an item on a deleted card and an item on someone else's
    board all raise the same ``AppError(404)``.
    """
    item = db.session.get(ChecklistItem, item_id)
    if item is None:
        raise AppError(404, ITEM_NOT_FOUND)
    get_card_for_member(user_id, item.card_id, ITEM_NOT_FOUND)
    return item
