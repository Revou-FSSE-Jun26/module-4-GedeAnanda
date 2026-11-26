from flask import Blueprint, request

from app.blueprints.auth import service
from app.blueprints.auth.schema import LoginSchema, RegisterSchema
from app.blueprints.users.schema import UserOut
from app.utils.responses import success

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/api/auth/register")
def register():
    data = RegisterSchema().load(request.get_json())
    user = service.register_user(data)
    return success(UserOut().dump(user), 201)


@auth_bp.post("/api/auth/login")
def login():
    data = LoginSchema().load(request.get_json())
    result = service.login_user(data)
    return success(
        {"access_token": result["access_token"], "user": UserOut().dump(result["user"])}
    )
