from marshmallow import Schema, fields, validate

from app.blueprints.cards.schema import CardOut
from app.blueprints.columns.schema import ColumnOut
from app.utils.auth import ROLE_ADMIN, ROLE_MEMBER
from app.utils.fields import TrimmedString

ROLES = (ROLE_ADMIN, ROLE_MEMBER)


class BoardSchema(Schema):
    name = TrimmedString(required=True, validate=validate.Length(min=1, max=100))


class MemberAddSchema(Schema):
    email = fields.Email(required=True)
    role = fields.String(required=True, validate=validate.OneOf(ROLES))


class MemberRoleSchema(Schema):
    role = fields.String(required=True, validate=validate.OneOf(ROLES))


class BoardOut(Schema):
    """A board as seen by one of its members. Dumps a ``BoardMember`` row,
    so ``role`` is the requesting user's role on the board."""

    id = fields.UUID(attribute="board.id", dump_only=True)
    name = fields.String(attribute="board.name", dump_only=True)
    role = fields.String(dump_only=True)
    created_at = fields.DateTime(attribute="board.created_at", dump_only=True)


class BoardColumnOut(ColumnOut):
    cards = fields.Nested(CardOut, many=True, dump_only=True)


class BoardDetailOut(BoardOut):
    columns = fields.Nested(BoardColumnOut, many=True, attribute="board.columns", dump_only=True)


class MemberOut(Schema):
    user_id = fields.UUID(dump_only=True)
    name = fields.String(attribute="user.name", dump_only=True)
    email = fields.Email(attribute="user.email", dump_only=True)
    role = fields.String(dump_only=True)
