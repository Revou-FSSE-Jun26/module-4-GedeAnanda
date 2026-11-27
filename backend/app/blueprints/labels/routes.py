from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.labels import service
from app.blueprints.labels.schema import LabelOut, LabelSchema, LabelUpdateSchema
from app.utils.auth import current_user_id
from app.utils.responses import success

labels_bp = Blueprint("labels", __name__)


@labels_bp.get("/api/boards/<uuid:board_id>/labels")
@jwt_required()
def list_labels(board_id):
    labels = service.list_labels(current_user_id(), board_id)
    return success(LabelOut(many=True).dump(labels))


@labels_bp.post("/api/boards/<uuid:board_id>/labels")
@jwt_required()
def create_label(board_id):
    data = LabelSchema().load(request.get_json())
    label = service.create_label(current_user_id(), board_id, data)
    return success(LabelOut().dump(label), 201)


@labels_bp.patch("/api/labels/<uuid:label_id>")
@jwt_required()
def update_label(label_id):
    data = LabelUpdateSchema().load(request.get_json())
    label = service.update_label(current_user_id(), label_id, data)
    return success(LabelOut().dump(label))


@labels_bp.delete("/api/labels/<uuid:label_id>")
@jwt_required()
def delete_label(label_id):
    deleted_id = service.delete_label(current_user_id(), label_id)
    return success({"id": str(deleted_id)})
