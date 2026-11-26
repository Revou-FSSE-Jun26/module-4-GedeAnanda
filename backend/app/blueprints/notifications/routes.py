from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.notifications import service
from app.blueprints.notifications.schema import (
    NotificationOut,
    NotificationPageOut,
    NotificationQuerySchema,
)
from app.utils.auth import current_user_id
from app.utils.responses import success

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/api/notifications")
@jwt_required()
def list_notifications():
    params = NotificationQuerySchema().load(request.args.to_dict())
    page = service.list_notifications(current_user_id(), params)
    return success(NotificationPageOut().dump(page))


@notifications_bp.patch("/api/notifications/<uuid:notification_id>/read")
@jwt_required()
def mark_as_read(notification_id):
    notification = service.mark_as_read(current_user_id(), notification_id)
    return success(NotificationOut().dump(notification))
