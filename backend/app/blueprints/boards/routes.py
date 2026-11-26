from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.boards import service
from app.blueprints.boards.schema import (
    BoardDetailOut,
    BoardOut,
    BoardSchema,
    MemberAddSchema,
    MemberOut,
    MemberRoleSchema,
)
from app.utils.auth import current_user_id
from app.utils.responses import success

boards_bp = Blueprint("boards", __name__)


@boards_bp.post("/api/boards")
@jwt_required()
def create_board():
    data = BoardSchema().load(request.get_json())
    membership = service.create_board(current_user_id(), data)
    return success(BoardOut().dump(membership), 201)


@boards_bp.get("/api/boards")
@jwt_required()
def list_boards():
    memberships = service.list_boards(current_user_id())
    return success(BoardOut(many=True).dump(memberships))


@boards_bp.get("/api/boards/<uuid:board_id>")
@jwt_required()
def get_board(board_id):
    membership = service.get_board(current_user_id(), board_id)
    return success(BoardDetailOut().dump(membership))


@boards_bp.patch("/api/boards/<uuid:board_id>")
@jwt_required()
def rename_board(board_id):
    data = BoardSchema().load(request.get_json())
    membership = service.rename_board(current_user_id(), board_id, data)
    return success(BoardOut().dump(membership))


@boards_bp.delete("/api/boards/<uuid:board_id>")
@jwt_required()
def delete_board(board_id):
    deleted_id = service.delete_board(current_user_id(), board_id)
    return success({"id": str(deleted_id)})


@boards_bp.get("/api/boards/<uuid:board_id>/members")
@jwt_required()
def list_members(board_id):
    members = service.list_members(current_user_id(), board_id)
    return success(MemberOut(many=True).dump(members))


@boards_bp.post("/api/boards/<uuid:board_id>/members")
@jwt_required()
def add_member(board_id):
    data = MemberAddSchema().load(request.get_json())
    member = service.add_member(current_user_id(), board_id, data)
    return success(MemberOut().dump(member), 201)


@boards_bp.patch("/api/boards/<uuid:board_id>/members/<uuid:user_id>")
@jwt_required()
def update_member_role(board_id, user_id):
    data = MemberRoleSchema().load(request.get_json())
    member = service.update_member_role(current_user_id(), board_id, user_id, data)
    return success(MemberOut().dump(member))


@boards_bp.delete("/api/boards/<uuid:board_id>/members/<uuid:user_id>")
@jwt_required()
def remove_member(board_id, user_id):
    removed_id = service.remove_member(current_user_id(), board_id, user_id)
    return success({"id": str(removed_id)})
