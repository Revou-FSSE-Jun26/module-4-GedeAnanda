from marshmallow import Schema, fields, validate

from app.utils.fields import TrimmedString


class CommentSchema(Schema):
    """Input for creating and editing a comment."""

    content = TrimmedString(required=True, validate=validate.Length(min=1, max=2000))


class AuthorOut(Schema):
    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)


class CommentOut(Schema):
    id = fields.UUID(dump_only=True)
    card_id = fields.UUID(dump_only=True)
    content = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    author = fields.Nested(AuthorOut, dump_only=True)
