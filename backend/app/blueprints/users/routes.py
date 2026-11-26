from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.users import service
from app.blueprints.users.schema import UserOut, UserUpdateSchema
from app.utils.auth import current_user_id
from app.utils.responses import success

users_bp = Blueprint("users", __name__)


@users_bp.get("/api/users/me")
@jwt_required()
def get_me():
    user = service.get_current_user(current_user_id())
    return success(UserOut().dump(user))


@users_bp.patch("/api/users/me")
@jwt_required()
def update_me():
    data = UserUpdateSchema().load(request.get_json())
    user = service.update_user(current_user_id(), data)
    return success(UserOut().dump(user))
