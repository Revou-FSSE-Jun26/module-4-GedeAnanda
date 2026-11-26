from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.columns import service
from app.blueprints.columns.schema import (
    ColumnOut,
    ColumnReorderOut,
    ColumnReorderSchema,
    ColumnSchema,
    ColumnUpdateSchema,
)
from app.utils.auth import current_user_id
from app.utils.responses import success

columns_bp = Blueprint("columns", __name__)


@columns_bp.post("/api/boards/<uuid:board_id>/columns")
@jwt_required()
def create_column(board_id):
    data = ColumnSchema().load(request.get_json())
    column = service.create_column(current_user_id(), board_id, data)
    return success(ColumnOut().dump(column), 201)


@columns_bp.patch("/api/boards/<uuid:board_id>/columns/reorder")
@jwt_required()
def reorder_column(board_id):
    data = ColumnReorderSchema().load(request.get_json())
    result = service.reorder_column(current_user_id(), board_id, data)
    return success(ColumnReorderOut().dump(result))


@columns_bp.patch("/api/columns/<uuid:column_id>")
@jwt_required()
def update_column(column_id):
    data = ColumnUpdateSchema().load(request.get_json())
    column = service.update_column(current_user_id(), column_id, data)
    return success(ColumnOut().dump(column))


@columns_bp.delete("/api/columns/<uuid:column_id>")
@jwt_required()
def delete_column(column_id):
    deleted_id = service.delete_column(current_user_id(), column_id)
    return success({"id": str(deleted_id)})
