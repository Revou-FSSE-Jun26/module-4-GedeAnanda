"""Marshmallow fields shared by several blueprints."""

from marshmallow import fields


class TrimmedString(fields.String):
    """A string whose surrounding whitespace is removed before validation.

    ``Length(min=1)`` therefore rejects a value made only of spaces.
    """

    def _deserialize(self, value, attr, data, **kwargs):
        return super()._deserialize(value, attr, data, **kwargs).strip()
