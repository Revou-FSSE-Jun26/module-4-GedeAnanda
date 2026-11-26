from marshmallow import Schema, fields, pre_load, validate


class RegisterSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(required=True, validate=validate.Length(max=255))
    password = fields.String(required=True, validate=validate.Length(min=8), load_only=True)

    @pre_load
    def strip_name(self, data, **kwargs):
        """Trim the name before validation, so a name of only spaces is rejected."""
        if isinstance(data, dict) and isinstance(data.get("name"), str):
            return {**data, "name": data["name"].strip()}
        return data


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
