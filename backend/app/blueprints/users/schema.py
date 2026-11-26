from marshmallow import Schema, fields


class UserOut(Schema):
    """Public view of a user. ``password_hash`` is deliberately absent (BE-05)."""

    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    email = fields.Email(dump_only=True)
