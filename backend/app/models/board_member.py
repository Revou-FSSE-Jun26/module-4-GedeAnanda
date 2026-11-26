from app.extensions import db
from app.models.base import BaseModel


class BoardMember(BaseModel):
    __tablename__ = "board_members"
    __table_args__ = (db.UniqueConstraint("board_id", "user_id", name="uq_board_member"),)

    board_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("boards.id"), nullable=False, index=True
    )
    user_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True
    )
    role = db.Column(db.String(10), nullable=False)  # "admin" | "member"

    board = db.relationship("Board", back_populates="members")
    user = db.relationship("User", back_populates="board_memberships")
