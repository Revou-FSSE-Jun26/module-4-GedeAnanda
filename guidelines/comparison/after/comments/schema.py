from marshmallow import Schema, fields, validate


class CommentSchema(Schema):
    """Input for creating and editing a comment."""

    content = fields.String(required=True, validate=validate.Length(min=1, max=2000))


class CommentAuthorOut(Schema):
    id = fields.UUID()
    name = fields.String()


class CommentOut(Schema):
    id = fields.UUID()
    card_id = fields.UUID()
    content = fields.String()
    author = fields.Nested(CommentAuthorOut)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
