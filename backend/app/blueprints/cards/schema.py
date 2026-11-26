from marshmallow import EXCLUDE, Schema, ValidationError, fields, validate, validates_schema

from app.blueprints.columns.schema import OrderOut
from app.utils.fields import TrimmedString

PRIORITIES = ("low", "medium", "high")
TITLE_LENGTH = validate.Length(min=1, max=200)
DESCRIPTION_LENGTH = validate.Length(max=5000)


class CardSchema(Schema):
    title = TrimmedString(required=True, validate=TITLE_LENGTH)
    description = fields.String(allow_none=True, load_default=None, validate=DESCRIPTION_LENGTH)
    assignee_id = fields.UUID(allow_none=True, load_default=None)
    due_date = fields.Date(allow_none=True, load_default=None)
    priority = fields.String(load_default="medium", validate=validate.OneOf(PRIORITIES))


class CardUpdateSchema(Schema):
    """Every field is optional; ``null`` clears description, assignee or due date."""

    title = TrimmedString(validate=TITLE_LENGTH)
    description = fields.String(allow_none=True, validate=DESCRIPTION_LENGTH)
    assignee_id = fields.UUID(allow_none=True)
    due_date = fields.Date(allow_none=True)
    priority = fields.String(validate=validate.OneOf(PRIORITIES))

    @validates_schema
    def require_a_field(self, data, **kwargs):
        if not data:
            raise ValidationError("Provide at least one field to update")


class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0, min_inclusive=False))


class CardQuerySchema(Schema):
    class Meta:
        unknown = EXCLUDE

    assignee = fields.String(validate=validate.OneOf(["me"]))
    board_id = fields.UUID()
    q = fields.String()

    @validates_schema
    def require_a_scope(self, data, **kwargs):
        if "assignee" not in data and "board_id" not in data:
            raise ValidationError("assignee or board_id is required")


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


class CardMoveOut(Schema):
    card = fields.Nested(CardOut, dump_only=True)
    rebalanced = fields.Boolean(dump_only=True)
    column_orders = fields.Nested(OrderOut, many=True, dump_only=True)
