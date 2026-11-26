import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from app.extensions import db
from app.models import BoardColumn, BoardMember, Card, Comment, User
from app.models.base import utc_now
from app.models.card import active_cards
from app.utils.auth import require_admin

ACTIVITY_WINDOW = timedelta(days=7)


def start_of_iso_week(moment: datetime) -> datetime:
    """Monday 00:00 of the week ``moment`` falls in, in the same timezone."""
    monday = moment - timedelta(days=moment.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def get_analytics(user_id: uuid.UUID, board_id: uuid.UUID) -> dict:
    """Board metrics for admins. A fixed number of aggregate queries, whatever the board size."""
    require_admin(user_id, board_id)
    now = utc_now()
    # Every count below goes through this alias, so soft-deleted cards are never counted (DB-04).
    ActiveCard = aliased(Card, active_cards().subquery())
    on_board = BoardColumn.board_id == board_id

    cards_per_column = db.session.execute(
        select(
            BoardColumn.id.label("column_id"),
            BoardColumn.name.label("column_name"),
            func.count(ActiveCard.id).label("count"),
        )
        .outerjoin(ActiveCard, ActiveCard.column_id == BoardColumn.id)
        .where(on_board)
        .group_by(BoardColumn.id)
        .order_by(BoardColumn.order)
    ).all()

    completed_this_week = db.session.scalar(
        select(func.count(ActiveCard.id))
        .join(BoardColumn, ActiveCard.column_id == BoardColumn.id)
        .where(on_board, ActiveCard.completed_at.between(start_of_iso_week(now), now))
    )

    def count_by(user_column, *conditions, source=ActiveCard):
        """``{user_id: count}`` over the board's active cards, or rows joined to them."""
        query = select(user_column, func.count()).select_from(source)
        if source is not ActiveCard:
            query = query.join(ActiveCard, source.card_id == ActiveCard.id)
        query = query.join(BoardColumn, ActiveCard.column_id == BoardColumn.id)
        query = query.where(on_board, *conditions).group_by(user_column)
        return dict(db.session.execute(query).all())

    created = count_by(ActiveCard.created_by)
    assigned = count_by(ActiveCard.assignee_id, ActiveCard.assignee_id.is_not(None))
    commented = count_by(
        Comment.author_id, Comment.created_at >= now - ACTIVITY_WINDOW, source=Comment
    )

    members = db.session.execute(
        select(User.id, User.name)
        .join(BoardMember, BoardMember.user_id == User.id)
        .where(BoardMember.board_id == board_id)
        .order_by(User.name, User.id)
    ).all()

    return {
        "cards_per_column": cards_per_column,
        "completed_this_week": completed_this_week,
        "member_activity": [
            {
                "user_id": member.id,
                "name": member.name,
                "cards_created": created.get(member.id, 0),
                "cards_assigned": assigned.get(member.id, 0),
                "comments_last_7_days": commented.get(member.id, 0),
            }
            for member in members
        ],
    }
