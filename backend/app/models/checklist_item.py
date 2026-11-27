from app.extensions import db
from app.models.base import BaseModel


class ChecklistItem(BaseModel):
    """One step of a card's checklist."""

    __tablename__ = "checklist_items"

    card_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("cards.id"), nullable=False, index=True
    )
    text = db.Column(db.String(300), nullable=False)
    is_done = db.Column(db.Boolean, default=False, nullable=False)
    order = db.Column(db.Float, nullable=False)

    card = db.relationship("Card", back_populates="checklist")
