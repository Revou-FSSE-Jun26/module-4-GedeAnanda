from app.extensions import db
from app.models.base import BaseModel


class Board(BaseModel):
    __tablename__ = "boards"

    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)

    owner = db.relationship("User", foreign_keys=[owner_id])
    members = db.relationship("BoardMember", back_populates="board", cascade="all, delete-orphan")
    labels = db.relationship(
        "Label", back_populates="board", cascade="all, delete-orphan", order_by="Label.name"
    )
    columns = db.relationship(
        "BoardColumn",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="BoardColumn.order",
    )
