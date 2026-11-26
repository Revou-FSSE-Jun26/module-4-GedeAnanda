from marshmallow import Schema, fields


class ColumnCountOut(Schema):
    column_id = fields.UUID(dump_only=True)
    column_name = fields.String(dump_only=True)
    count = fields.Integer(dump_only=True)


class MemberActivityOut(Schema):
    user_id = fields.UUID(dump_only=True)
    name = fields.String(dump_only=True)
    cards_created = fields.Integer(dump_only=True)
    cards_assigned = fields.Integer(dump_only=True)
    comments_last_7_days = fields.Integer(dump_only=True)


class AnalyticsOut(Schema):
    cards_per_column = fields.Nested(ColumnCountOut, many=True, dump_only=True)
    completed_this_week = fields.Integer(dump_only=True)
    member_activity = fields.Nested(MemberActivityOut, many=True, dump_only=True)
