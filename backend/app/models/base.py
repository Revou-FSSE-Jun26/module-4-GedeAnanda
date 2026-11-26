"""Column helpers shared by every model (guidelines DB-01, DB-02)."""

import uuid
from datetime import datetime, timezone

from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BaseModel(db.Model):
    """UUID primary key plus timezone-aware ``created_at`` / ``updated_at``."""

    __abstract__ = True

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = db.Column(db.DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )
