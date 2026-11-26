from marshmallow import Schema, fields


class ColumnOut(Schema):
    id = fields.UUID(dump_only=True)
    board_id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    order = fields.Float(dump_only=True)
    is_done = fields.Boolean(dump_only=True)
