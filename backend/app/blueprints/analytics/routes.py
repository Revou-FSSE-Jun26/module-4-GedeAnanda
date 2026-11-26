from flask import Blueprint
from flask_jwt_extended import jwt_required

from app.blueprints.analytics import service
from app.blueprints.analytics.schema import AnalyticsOut
from app.utils.auth import current_user_id
from app.utils.responses import success

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/api/boards/<uuid:board_id>/analytics")
@jwt_required()
def get_analytics(board_id):
    analytics = service.get_analytics(current_user_id(), board_id)
    return success(AnalyticsOut().dump(analytics))
