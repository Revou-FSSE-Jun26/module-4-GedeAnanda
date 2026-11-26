from app.extensions import db
from app.models.base import BaseModel

NOTIFICATION_TYPES = ("card_assigned", "comment_added", "board_invite")


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True
    )
    type = db.Column(db.String(20), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    # SET NULL: hard-deleting a board or a column must not fail because a notification points at it.
    card_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    board_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("boards.id", ondelete="SET NULL"), nullable=True
    )

    user = db.relationship("User", back_populates="notifications")
    card = db.relationship("Card")
    board = db.relationship("Board")
