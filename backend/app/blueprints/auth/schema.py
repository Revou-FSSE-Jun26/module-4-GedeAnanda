from marshmallow import Schema, fields, validate

from app.utils.fields import TrimmedString


class RegisterSchema(Schema):
    name = TrimmedString(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(required=True, validate=validate.Length(max=255))
    password = fields.String(required=True, validate=validate.Length(min=8), load_only=True)


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
