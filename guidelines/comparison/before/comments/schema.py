from marshmallow import EXCLUDE, Schema, fields, pre_load, validate


class CommentInputSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    content = fields.String(
        required=True,
        validate=validate.Length(
            min=1, max=2000, error="content must be between 1 and 2000 characters"
        ),
        error_messages={
            "required": "content is required",
            "null": "content is required",
            "invalid": "content must be a string",
        },
    )

    @pre_load
    def strip_content(self, data, **kwargs):
        if isinstance(data, dict) and isinstance(data.get("content"), str):
            data = {**data, "content": data["content"].strip()}
        return data


class AuthorSchema(Schema):
    id = fields.UUID()
    name = fields.String()


class CommentSchema(Schema):
    id = fields.UUID()
    card_id = fields.UUID()
    content = fields.String()
    author = fields.Nested(AuthorSchema)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


comment_input_schema = CommentInputSchema()
comment_schema = CommentSchema()
comments_schema = CommentSchema(many=True)
