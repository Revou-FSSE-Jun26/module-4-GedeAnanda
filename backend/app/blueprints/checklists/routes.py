from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.checklists import service
from app.blueprints.checklists.schema import (
    ChecklistItemOut,
    ChecklistItemSchema,
    ChecklistItemUpdateSchema,
)
from app.utils.auth import current_user_id
from app.utils.responses import success

checklists_bp = Blueprint("checklists", __name__)


@checklists_bp.post("/api/cards/<uuid:card_id>/checklist")
@jwt_required()
def add_item(card_id):
    data = ChecklistItemSchema().load(request.get_json())
    item = service.add_item(current_user_id(), card_id, data)
    return success(ChecklistItemOut().dump(item), 201)


@checklists_bp.patch("/api/checklist-items/<uuid:item_id>")
@jwt_required()
def update_item(item_id):
    data = ChecklistItemUpdateSchema().load(request.get_json())
    item = service.update_item(current_user_id(), item_id, data)
    return success(ChecklistItemOut().dump(item))


@checklists_bp.delete("/api/checklist-items/<uuid:item_id>")
@jwt_required()
def delete_item(item_id):
    deleted_id = service.delete_item(current_user_id(), item_id)
    return success({"id": str(deleted_id)})
