from app.extensions import db
from app.models.base import BaseModel

LABEL_COLORS = ("cobalt", "teal", "plum", "poppy", "amber", "moss")


class Label(BaseModel):
    """A coloured tag that belongs to one board and can be put on its cards."""

    __tablename__ = "labels"
    __table_args__ = (db.UniqueConstraint("board_id", "name", name="uq_label_board_name"),)

    board_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("boards.id"), nullable=False, index=True
    )
    name = db.Column(db.String(40), nullable=False)
    color = db.Column(db.String(10), nullable=False)  # one of LABEL_COLORS

    board = db.relationship("Board", back_populates="labels")
    card_links = db.relationship("CardLabel", back_populates="label", cascade="all, delete-orphan")


class CardLabel(BaseModel):
    """One label on one card."""

    __tablename__ = "card_labels"
    __table_args__ = (db.UniqueConstraint("card_id", "label_id", name="uq_card_label"),)

    card_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("cards.id"), nullable=False, index=True
    )
    label_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("labels.id"), nullable=False, index=True
    )

    card = db.relationship("Card", back_populates="label_links")
    label = db.relationship("Label", back_populates="card_links")
