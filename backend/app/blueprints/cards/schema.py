from marshmallow import Schema, fields


class AssigneeOut(Schema):
    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)


class CardOut(Schema):
    id = fields.UUID(dump_only=True)
    column_id = fields.UUID(dump_only=True)
    board_id = fields.UUID(dump_only=True)
    board_name = fields.String(dump_only=True)
    title = fields.String(dump_only=True)
    description = fields.String(dump_only=True, allow_none=True)
    priority = fields.String(dump_only=True)
    due_date = fields.Date(dump_only=True, allow_none=True)
    order = fields.Float(dump_only=True)
    completed_at = fields.DateTime(dump_only=True, allow_none=True)
    created_by = fields.UUID(dump_only=True)
    assignee = fields.Nested(AssigneeOut, dump_only=True, allow_none=True)
