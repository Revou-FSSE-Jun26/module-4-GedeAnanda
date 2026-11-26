from app.extensions import db
from app.models.base import BaseModel


class Card(BaseModel):
    __tablename__ = "cards"

    column_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("columns.id"), nullable=False, index=True
    )
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(5000), nullable=True)
    assignee_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True, index=True
    )
    created_by = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    priority = db.Column(db.String(10), default="medium", nullable=False)  # low | medium | high
    order = db.Column(db.Float, nullable=False)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    column = db.relationship("BoardColumn", back_populates="cards")
    creator = db.relationship("User", foreign_keys=[created_by], back_populates="created_cards")
    assignee = db.relationship("User", foreign_keys=[assignee_id], back_populates="assigned_cards")
    comments = db.relationship("Comment", back_populates="card", cascade="all, delete-orphan")


def active_cards():
    """Starting point for every card query: excludes soft-deleted cards (guideline DB-04)."""
    return db.select(Card).where(Card.deleted_at.is_(None))
