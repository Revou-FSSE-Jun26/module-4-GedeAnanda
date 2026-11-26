from marshmallow import Schema, ValidationError, fields, validate, validates_schema

from app.utils.fields import TrimmedString

NAME_LENGTH = validate.Length(min=1, max=100)


class ColumnSchema(Schema):
    name = TrimmedString(required=True, validate=NAME_LENGTH)
    is_done = fields.Boolean(load_default=False)


class ColumnUpdateSchema(Schema):
    name = TrimmedString(validate=NAME_LENGTH)
    is_done = fields.Boolean()

    @validates_schema
    def require_a_field(self, data, **kwargs):
        if not data:
            raise ValidationError("Provide name or is_done")


class ColumnReorderSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0, min_inclusive=False))


class ColumnOut(Schema):
    id = fields.UUID(dump_only=True)
    board_id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    order = fields.Float(dump_only=True)
    is_done = fields.Boolean(dump_only=True)


class OrderOut(Schema):
    id = fields.UUID(dump_only=True)
    order = fields.Float(dump_only=True)


class ColumnReorderOut(Schema):
    column = fields.Nested(ColumnOut, dump_only=True)
    rebalanced = fields.Boolean(dump_only=True)
    column_orders = fields.Nested(OrderOut, many=True, dump_only=True)
