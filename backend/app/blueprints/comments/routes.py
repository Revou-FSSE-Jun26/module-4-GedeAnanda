from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.comments import service
from app.blueprints.comments.schema import CommentOut, CommentSchema
from app.utils.auth import current_user_id
from app.utils.responses import success

comments_bp = Blueprint("comments", __name__)


@comments_bp.post("/api/cards/<uuid:card_id>/comments")
@jwt_required()
def create_comment(card_id):
    data = CommentSchema().load(request.get_json())
    comment = service.create_comment(current_user_id(), card_id, data)
    return success(CommentOut().dump(comment), 201)


@comments_bp.get("/api/cards/<uuid:card_id>/comments")
@jwt_required()
def list_comments(card_id):
    comments = service.list_comments(current_user_id(), card_id)
    return success(CommentOut(many=True).dump(comments))


@comments_bp.patch("/api/comments/<uuid:comment_id>")
@jwt_required()
def update_comment(comment_id):
    data = CommentSchema().load(request.get_json())
    comment = service.update_comment(current_user_id(), comment_id, data)
    return success(CommentOut().dump(comment))


@comments_bp.delete("/api/comments/<uuid:comment_id>")
@jwt_required()
def delete_comment(comment_id):
    deleted_id = service.delete_comment(current_user_id(), comment_id)
    return success({"id": str(deleted_id)})
