from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from . import service
from .schema import comment_input_schema, comment_schema, comments_schema

comments_bp = Blueprint("comments", __name__, url_prefix="/api")


@comments_bp.errorhandler(service.CommentError)
def handle_comment_error(err):
    return jsonify({"error": err.message}), err.status_code


@comments_bp.errorhandler(ValidationError)
def handle_validation_error(err):
    messages = err.messages
    if isinstance(messages, dict):
        first = next(iter(messages.values()), None)
        message = first[0] if isinstance(first, list) and first else "Invalid request body"
    else:
        message = "Invalid request body"
    return jsonify({"error": message}), 400


def _load_content():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise service.CommentError("Request body must be a JSON object", 400)
    return comment_input_schema.load(payload)["content"]


@comments_bp.route("/cards/<card_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(card_id):
    content = _load_content()
    comment = service.add_comment(card_id, get_jwt_identity(), content)
    return jsonify({"data": comment_schema.dump(comment)}), 201


@comments_bp.route("/cards/<card_id>/comments", methods=["GET"])
@jwt_required()
def list_comments(card_id):
    comments = service.list_comments(card_id, get_jwt_identity())
    return jsonify({"data": comments_schema.dump(comments)}), 200


@comments_bp.route("/comments/<comment_id>", methods=["PATCH"])
@jwt_required()
def update_comment(comment_id):
    content = _load_content()
    comment = service.update_comment(comment_id, get_jwt_identity(), content)
    return jsonify({"data": comment_schema.dump(comment)}), 200


@comments_bp.route("/comments/<comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id):
    deleted_id = service.delete_comment(comment_id, get_jwt_identity())
    return jsonify({"data": {"id": str(deleted_id)}}), 200
