from marshmallow import EXCLUDE, Schema, fields, validate


class NotificationQuerySchema(Schema):
    class Meta:
        unknown = EXCLUDE

    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


class NotificationOut(Schema):
    id = fields.UUID(dump_only=True)
    type = fields.String(dump_only=True)
    message = fields.String(dump_only=True)
    is_read = fields.Boolean(dump_only=True)
    card_id = fields.UUID(dump_only=True, allow_none=True)
    board_id = fields.UUID(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class NotificationPageOut(Schema):
    items = fields.Nested(NotificationOut, many=True, dump_only=True)
    page = fields.Integer(dump_only=True)
    per_page = fields.Integer(dump_only=True)
    total = fields.Integer(dump_only=True)
    unread_count = fields.Integer(dump_only=True)
