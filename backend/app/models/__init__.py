"""Re-exports every model so SQLAlchemy and Flask-Migrate can discover them."""

from app.models.board import Board
from app.models.board_member import BoardMember
from app.models.card import Card
from app.models.column import BoardColumn
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.user import User

__all__ = ["Board", "BoardColumn", "BoardMember", "Card", "Comment", "Notification", "User"]
