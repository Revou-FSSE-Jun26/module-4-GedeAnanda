import uuid

from sqlalchemy import func, select

from app.exceptions import AppError
from app.extensions import db
from app.models import Card, CardLabel, Label
from app.utils.auth import require_admin, require_member

LABEL_NOT_FOUND = "Label not found"


def list_labels(user_id: uuid.UUID, board_id: uuid.UUID) -> list[Label]:
    require_member(user_id, board_id)
    return db.session.scalars(
        select(Label).where(Label.board_id == board_id).order_by(Label.name, Label.id)
    ).all()


def create_label(user_id: uuid.UUID, board_id: uuid.UUID, data: dict) -> Label:
    require_member(user_id, board_id)
    ensure_name_is_free(board_id, data["name"])
    label = Label(board_id=board_id, name=data["name"], color=data["color"])
    db.session.add(label)
    db.session.commit()
    return label


def update_label(user_id: uuid.UUID, label_id: uuid.UUID, data: dict) -> Label:
    label = get_label_for_member(user_id, label_id)
    if "name" in data:
        ensure_name_is_free(label.board_id, data["name"], except_id=label.id)
    for field, value in data.items():
        setattr(label, field, value)
    db.session.commit()
    return label


def delete_label(user_id: uuid.UUID, label_id: uuid.UUID) -> uuid.UUID:
    """Delete the label; the ORM cascade takes it off every card that has it."""
    label = get_label_for_member(user_id, label_id)
    require_admin(user_id, label.board_id, LABEL_NOT_FOUND)
    db.session.delete(label)
    db.session.commit()
    return label_id


def set_card_labels(card: Card, label_ids: list[uuid.UUID]) -> None:
    """Make the card's labels exactly ``label_ids``. The caller commits.

    Every ID must be a label of the card's board; otherwise nothing changes.
    """
    wanted = set(label_ids)
    if wanted:
        found = set(
            db.session.scalars(
                select(Label.id).where(
                    Label.board_id == card.column.board_id, Label.id.in_(wanted)
                )
            )
        )
        if found != wanted:
            raise AppError(400, "label_ids: Every label must belong to this card's board")

    current = {link.label_id: link for link in card.label_links}
    for label_id, link in current.items():
        if label_id not in wanted:
            card.label_links.remove(link)
    for label_id in wanted - set(current):
        card.label_links.append(CardLabel(label_id=label_id))


def get_label_for_member(user_id: uuid.UUID, label_id: uuid.UUID) -> Label:
    """Return a label of a board the caller belongs to.

    An unknown label and a label on someone else's board raise the same ``AppError(404)``.
    """
    label = db.session.get(Label, label_id)
    if label is None:
        raise AppError(404, LABEL_NOT_FOUND)
    require_member(user_id, label.board_id, LABEL_NOT_FOUND)
    return label


def ensure_name_is_free(
    board_id: uuid.UUID, name: str, except_id: uuid.UUID | None = None
) -> None:
    """A board cannot have two labels whose names differ only in letter case."""
    query = select(Label.id).where(
        Label.board_id == board_id, func.lower(Label.name) == name.lower()
    )
    if except_id is not None:
        query = query.where(Label.id != except_id)
    if db.session.scalar(query) is not None:
        raise AppError(409, "This board already has a label with that name")
