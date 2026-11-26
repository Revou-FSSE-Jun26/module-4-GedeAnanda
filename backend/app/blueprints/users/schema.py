from marshmallow import Schema, ValidationError, fields, validate, validates, validates_schema

from app.utils.fields import TrimmedString


class UserOut(Schema):
    """Public view of a user. ``password_hash`` is deliberately absent (BE-05)."""

    id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    email = fields.Email(dump_only=True)


class UserUpdateSchema(Schema):
    name = TrimmedString(validate=validate.Length(min=1, max=100))
    email = fields.Email(validate=validate.Length(max=255))
    # Declared only so that sending it gets a clear message instead of "Unknown field".
    password = fields.Raw(load_only=True)

    @validates("password")
    def reject_password(self, value, **kwargs):
        raise ValidationError("The password cannot be changed here")

    @validates_schema
    def require_a_field(self, data, **kwargs):
        if not data:
            raise ValidationError("Provide name or email")
