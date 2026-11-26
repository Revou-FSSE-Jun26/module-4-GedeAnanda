import uuid

from sqlalchemy import func, select

from app.exceptions import AppError
from app.extensions import db
from app.models import BoardColumn
from app.utils.auth import require_admin, require_member
from app.utils.ordering import next_order, rebalance_if_needed

COLUMN_NOT_FOUND = "Column not found"


def create_column(user_id: uuid.UUID, board_id: uuid.UUID, data: dict) -> BoardColumn:
    require_member(user_id, board_id)
    last_order = db.session.scalar(
        select(func.max(BoardColumn.order)).where(BoardColumn.board_id == board_id)
    )
    column = BoardColumn(
        board_id=board_id,
        name=data["name"],
        is_done=data["is_done"],
        order=next_order(last_order),
    )
    db.session.add(column)
    db.session.commit()
    return column


def update_column(user_id: uuid.UUID, column_id: uuid.UUID, data: dict) -> BoardColumn:
    column = get_column(column_id)
    require_member(user_id, column.board_id, COLUMN_NOT_FOUND)
    for field in ("name", "is_done"):
        if field in data:
            setattr(column, field, data[field])
    db.session.commit()
    return column


def delete_column(user_id: uuid.UUID, column_id: uuid.UUID) -> uuid.UUID:
    """Hard-delete the column; its cards and their comments go with it."""
    column = get_column(column_id)
    require_admin(user_id, column.board_id, COLUMN_NOT_FOUND)
    db.session.delete(column)
    db.session.commit()
    return column_id


def reorder_column(user_id: uuid.UUID, board_id: uuid.UUID, data: dict) -> dict:
    """Store the moved column's new order, renumbering the board only if orders collide."""
    require_member(user_id, board_id)
    columns = db.session.scalars(
        select(BoardColumn).where(BoardColumn.board_id == board_id)
    ).all()
    column = next((item for item in columns if item.id == data["column_id"]), None)
    if column is None:
        raise AppError(400, "column_id: Not a column on this board")

    column.order = data["order"]
    rebalanced = rebalance_if_needed(columns)
    db.session.commit()
    return {
        "column": column,
        "rebalanced": rebalanced,
        "column_orders": sorted(columns, key=lambda item: item.order) if rebalanced else [],
    }


def get_column(column_id: uuid.UUID) -> BoardColumn:
    column = db.session.get(BoardColumn, column_id)
    if column is None:
        raise AppError(404, COLUMN_NOT_FOUND)
    return column
