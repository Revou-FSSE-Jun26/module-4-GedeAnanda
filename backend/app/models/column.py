from app.extensions import db
from app.models.base import BaseModel


class BoardColumn(BaseModel):
    """A column on a board. Named ``BoardColumn`` so it does not shadow ``sqlalchemy.Column``."""

    __tablename__ = "columns"

    board_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("boards.id"), nullable=False, index=True
    )
    name = db.Column(db.String(100), nullable=False)
    order = db.Column(db.Float, nullable=False)
    is_done = db.Column(db.Boolean, default=False, nullable=False)

    board = db.relationship("Board", back_populates="columns")
    cards = db.relationship(
        "Card", back_populates="column", cascade="all, delete-orphan", order_by="Card.order"
    )
