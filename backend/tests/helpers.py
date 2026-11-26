"""Helpers shared by the test modules."""

from datetime import datetime, timezone

from app.extensions import db
from app.models import BoardColumn, Card, Comment, Notification


def assert_error(res, status):
    assert res.status_code == status
    body = res.get_json()
    assert set(body) == {"error"}
    assert isinstance(body["error"], str) and body["error"]
    return body["error"]


def add_column(board, name, order, is_done=False):
    column = BoardColumn(board_id=board.id, name=name, order=order, is_done=is_done)
    db.session.add(column)
    db.session.commit()
    return column


def add_card(column, creator, title, order, assignee=None, deleted=False):
    card = Card(
        column_id=column.id,
        title=title,
        order=order,
        created_by=creator.id,
        assignee_id=assignee.id if assignee else None,
        deleted_at=datetime.now(timezone.utc) if deleted else None,
    )
    db.session.add(card)
    db.session.commit()
    return card


def add_comment(card, author, content, created_at=None):
    comment = Comment(card_id=card.id, author_id=author.id, content=content)
    if created_at is not None:
        comment.created_at = created_at
    db.session.add(comment)
    db.session.commit()
    return comment


def add_notification(user, message="Something happened", created_at=None, is_read=False):
    notification = Notification(
        user_id=user.id, type="board_invite", message=message, is_read=is_read
    )
    if created_at is not None:
        notification.created_at = created_at
    db.session.add(notification)
    db.session.commit()
    return notification
