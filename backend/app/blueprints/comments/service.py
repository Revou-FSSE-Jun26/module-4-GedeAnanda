import uuid

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.blueprints.cards.service import get_card_for_member
from app.blueprints.notifications import service as notifications
from app.exceptions import AppError
from app.extensions import db
from app.models import Comment

COMMENT_NOT_FOUND = "Comment not found"


def create_comment(user_id: uuid.UUID, card_id: uuid.UUID, data: dict) -> Comment:
    card, _ = get_card_for_member(user_id, card_id)
    comment = Comment(card_id=card.id, author_id=user_id, content=data["content"])
    db.session.add(comment)

    # N2: the card's creator and assignee, never the commenter.
    for recipient_id in {card.created_by, card.assignee_id} - {None, user_id}:
        notifications.create_notification(
            recipient_id,
            "comment_added",
            f"New comment on '{card.title}'",
            card_id=card.id,
            board_id=card.column.board_id,
        )
    db.session.commit()
    return comment


def list_comments(user_id: uuid.UUID, card_id: uuid.UUID) -> list[Comment]:
    card, _ = get_card_for_member(user_id, card_id)
    return db.session.scalars(
        select(Comment)
        .where(Comment.card_id == card.id)
        .options(joinedload(Comment.author))
        .order_by(Comment.created_at, Comment.id)
    ).all()


def update_comment(user_id: uuid.UUID, comment_id: uuid.UUID, data: dict) -> Comment:
    comment = get_comment_for_member(user_id, comment_id)
    if comment.author_id != user_id:
        raise AppError(403, "You can only edit your own comments")
    comment.content = data["content"]
    db.session.commit()
    return comment


def delete_comment(user_id: uuid.UUID, comment_id: uuid.UUID) -> uuid.UUID:
    comment = get_comment_for_member(user_id, comment_id)
    if comment.author_id != user_id:
        raise AppError(403, "You can only delete your own comments")
    db.session.delete(comment)
    db.session.commit()
    return comment_id


def get_comment_for_member(user_id: uuid.UUID, comment_id: uuid.UUID) -> Comment:
    """Return a comment on an active card of a board the caller belongs to.

    An unknown comment, a comment on a deleted card and a comment on someone
    else's board all raise the same ``AppError(404)``.
    """
    comment = db.session.get(Comment, comment_id)
    if comment is None:
        raise AppError(404, COMMENT_NOT_FOUND)
    get_card_for_member(user_id, comment.card_id, COMMENT_NOT_FOUND)
    return comment
