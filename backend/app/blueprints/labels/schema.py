from marshmallow import Schema, ValidationError, fields, validate, validates_schema

from app.models.label import LABEL_COLORS
from app.utils.fields import TrimmedString

NAME_LENGTH = validate.Length(min=1, max=40)
COLOR_CHOICE = validate.OneOf(LABEL_COLORS)


class LabelSchema(Schema):
    name = TrimmedString(required=True, validate=NAME_LENGTH)
    color = fields.String(required=True, validate=COLOR_CHOICE)


class LabelUpdateSchema(Schema):
    name = TrimmedString(validate=NAME_LENGTH)
    color = fields.String(validate=COLOR_CHOICE)

    @validates_schema
    def require_a_field(self, data, **kwargs):
        if not data:
            raise ValidationError("Provide name or color")


class LabelOut(Schema):
    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    color = fields.String(dump_only=True)
