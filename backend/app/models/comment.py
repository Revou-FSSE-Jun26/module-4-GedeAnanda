from app.extensions import db
from app.models.base import BaseModel


class Comment(BaseModel):
    __tablename__ = "comments"

    card_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("cards.id"), nullable=False, index=True
    )
    author_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.String(2000), nullable=False)

    card = db.relationship("Card", back_populates="comments")
    author = db.relationship("User", back_populates="comments")
