from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (db.UniqueConstraint("email", name="uq_users_email"),)

    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    board_memberships = db.relationship(
        "BoardMember", back_populates="user", cascade="all, delete-orphan"
    )
    created_cards = db.relationship(
        "Card", foreign_keys="Card.created_by", back_populates="creator"
    )
    assigned_cards = db.relationship(
        "Card", foreign_keys="Card.assignee_id", back_populates="assignee"
    )
    comments = db.relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    notifications = db.relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)
