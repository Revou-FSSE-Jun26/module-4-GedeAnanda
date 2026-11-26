from sqlalchemy.orm import contains_eager, joinedload, selectinload

from app.blueprints.notifications import service as notifications
from app.extensions import db
from app.models import Card, Comment
from app.models.card import active_cards
from app.utils.auth import require_member
from app.utils.errors import AppError


def get_card_for_member(user_id, card_id):
    """Return an active card the user can see, or raise 404."""
    stmt = active_cards().where(Card.id == card_id).options(joinedload(Card.column))
    card = db.session.scalars(stmt).first()
    if card is None:
        raise AppError(404, "Card not found")
    require_member(user_id, card.column.board_id)  # 404 if not a member
    return card


def get_comment_for_member(user_id, comment_id):
    """Return a comment on an active card the user can see, or raise 404."""
    stmt = (
        db.select(Comment)
        .join(Comment.card)
        .where(Comment.id == comment_id, Card.deleted_at.is_(None))
        .options(
            contains_eager(Comment.card).joinedload(Card.column),
            joinedload(Comment.author),
        )
    )
    comment = db.session.scalars(stmt).first()
    if comment is None:
        raise AppError(404, "Comment not found")
    require_member(user_id, comment.card.column.board_id)  # 404 if not a member
    return comment


def create_comment(user_id, card_id, data):
    card = get_card_for_member(user_id, card_id)

    comment = Comment(card_id=card.id, author_id=user_id, content=data["content"])
    db.session.add(comment)

    for recipient_id in {card.created_by, card.assignee_id} - {None, user_id}:
        notifications.create_notification(
            recipient_id, "comment_added", f"New comment on '{card.title}'", card_id=card.id
        )

    db.session.commit()
    return comment


def list_comments(user_id, card_id):
    card = get_card_for_member(user_id, card_id)
    stmt = (
        db.select(Comment)
        .where(Comment.card_id == card.id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    )
    return db.session.scalars(stmt).all()


def update_comment(user_id, comment_id, data):
    comment = get_comment_for_member(user_id, comment_id)
    if comment.author_id != user_id:
        raise AppError(403, "You can only edit your own comments")
    comment.content = data["content"]
    db.session.commit()
    return comment


def delete_comment(user_id, comment_id):
    comment = get_comment_for_member(user_id, comment_id)
    if comment.author_id != user_id:
        raise AppError(403, "You can only delete your own comments")
    deleted_id = comment.id
    db.session.delete(comment)
    db.session.commit()
    return deleted_id
