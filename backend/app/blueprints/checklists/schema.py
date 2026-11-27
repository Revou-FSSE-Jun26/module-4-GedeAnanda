from marshmallow import Schema, ValidationError, fields, validate, validates_schema

from app.utils.fields import TrimmedString

TEXT_LENGTH = validate.Length(min=1, max=300)


class ChecklistItemSchema(Schema):
    text = TrimmedString(required=True, validate=TEXT_LENGTH)


class ChecklistItemUpdateSchema(Schema):
    text = TrimmedString(validate=TEXT_LENGTH)
    is_done = fields.Boolean()

    @validates_schema
    def require_a_field(self, data, **kwargs):
        if not data:
            raise ValidationError("Provide text or is_done")


class ChecklistItemOut(Schema):
    id = fields.UUID(dump_only=True)
    card_id = fields.UUID(dump_only=True)
    text = fields.String(dump_only=True)
    is_done = fields.Boolean(dump_only=True)
