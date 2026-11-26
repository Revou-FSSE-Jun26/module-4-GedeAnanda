"""Test-only routes that trigger each kind of error handled by the app factory.

They are registered once, when the test app is created, because Flask does not
allow new routes after the first request.
"""

from flask import Flask, request
from flask_jwt_extended import jwt_required
from marshmallow import Schema, fields, validate

from app.exceptions import AppError
from app.utils.responses import success


class EchoSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1, max=5))


def register_probe_routes(app: Flask) -> None:
    @app.get("/api/_probe/boom")
    def probe_boom():
        raise RuntimeError("secret internal detail")

    @app.get("/api/_probe/app-error")
    def probe_app_error():
        raise AppError(409, "Already exists")

    @app.post("/api/_probe/echo")
    def probe_echo():
        return success(EchoSchema().load(request.get_json()))

    @app.get("/api/_probe/protected")
    @jwt_required()
    def probe_protected():
        return success({"ok": True})
