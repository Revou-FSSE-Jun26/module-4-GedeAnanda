import uuid

from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models import BoardColumn, BoardMember, Card, Comment, Notification, User


class CommentError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _not_found(what):
    return CommentError(f"{what} not found", 404)


def _to_uuid(value):
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _get_accessible_card(card_id, user_id):
    """Return the card if it exists, is not soft-deleted and the user is a
    member of its board. Anything else is reported as not found."""
    card_uuid = _to_uuid(card_id)
    if card_uuid is None:
        raise _not_found("Card")

    card = (
        db.session.query(Card)
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .join(BoardMember, BoardMember.board_id == BoardColumn.board_id)
        .filter(
            Card.id == card_uuid,
            Card.deleted_at.is_(None),
            BoardMember.user_id == user_id,
        )
        .first()
    )
    if card is None:
        raise _not_found("Card")
    return card


def _get_accessible_comment(comment_id, user_id):
    comment_uuid = _to_uuid(comment_id)
    if comment_uuid is None:
        raise _not_found("Comment")

    comment = db.session.get(Comment, comment_uuid)
    if comment is None:
        raise _not_found("Comment")

    try:
        _get_accessible_card(comment.card_id, user_id)
    except CommentError:
        raise _not_found("Comment") from None
    return comment


def _get_owned_comment(comment_id, user_id):
    comment = _get_accessible_comment(comment_id, user_id)
    if comment.author_id != user_id:
        raise CommentError("You can only modify your own comments", 403)
    return comment


def _current_user_id(identity):
    user_id = _to_uuid(identity)
    if user_id is None:
        raise CommentError("Invalid token", 401)
    return user_id


def add_comment(card_id, identity, content):
    user_id = _current_user_id(identity)
    card = _get_accessible_card(card_id, user_id)

    author = db.session.get(User, user_id)
    if author is None:
        raise CommentError("Invalid token", 401)

    comment = Comment(card_id=card.id, author_id=user_id, content=content)
    db.session.add(comment)

    recipients = {card.created_by, card.assignee_id} - {user_id, None}
    for recipient_id in recipients:
        db.session.add(
            Notification(
                user_id=recipient_id,
                type="comment_added",
                message=f'{author.name} commented on "{card.title}"',
                card_id=card.id,
                board_id=card.column.board_id,
            )
        )

    db.session.commit()
    return comment


def list_comments(card_id, identity):
    user_id = _current_user_id(identity)
    card = _get_accessible_card(card_id, user_id)

    return (
        db.session.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.card_id == card.id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .all()
    )


def update_comment(comment_id, identity, content):
    user_id = _current_user_id(identity)
    comment = _get_owned_comment(comment_id, user_id)
    comment.content = content
    db.session.commit()
    return comment


def delete_comment(comment_id, identity):
    user_id = _current_user_id(identity)
    comment = _get_owned_comment(comment_id, user_id)
    deleted_id = comment.id
    db.session.delete(comment)
    db.session.commit()
    return deleted_id
