"""Central error handling: every error leaves the API as ``{ "error": "..." }``.

Routes never build error responses themselves (guideline BE-03).
"""

from flask import Flask, jsonify
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

from app.exceptions import AppError
from app.extensions import jwt

TOKEN_ERROR = "Missing or invalid token"


def error_response(message: str, status_code: int):
    return jsonify({"error": message}), status_code


def first_validation_message(messages) -> str:
    """Return the first message from Marshmallow's nested error structure."""
    if isinstance(messages, dict):
        for field, value in messages.items():
            message = first_validation_message(value)
            if field in ("_schema", None) or isinstance(field, int):
                return message
            return f"{field}: {message}"
    if isinstance(messages, (list, tuple)) and messages:
        return first_validation_message(messages[0])
    if isinstance(messages, str):
        return messages
    return "Invalid request"


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(error: AppError):
        return error_response(error.message, error.status_code)

    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        return error_response(first_validation_message(error.messages), 400)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        # Covers malformed JSON (400), unknown routes (404), 405, 415 and so on.
        return error_response(error.description or error.name, error.code or 500)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unhandled exception")
        return error_response("Internal server error", 500)


def register_jwt_handlers() -> None:
    """Replace Flask-JWT-Extended's ``{ "msg": ... }`` / 422 defaults with the envelope."""

    @jwt.unauthorized_loader
    def handle_missing_token(reason: str):
        return error_response(TOKEN_ERROR, 401)

    @jwt.invalid_token_loader
    def handle_invalid_token(reason: str):
        return error_response(TOKEN_ERROR, 401)

    @jwt.expired_token_loader
    def handle_expired_token(jwt_header, jwt_payload):
        return error_response("Token has expired", 401)
