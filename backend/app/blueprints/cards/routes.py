from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.blueprints.cards import service
from app.blueprints.cards.schema import (
    CardMoveOut,
    CardOut,
    CardPositionSchema,
    CardQuerySchema,
    CardSchema,
    CardUpdateSchema,
)
from app.utils.auth import current_user_id
from app.utils.responses import success

cards_bp = Blueprint("cards", __name__)


@cards_bp.get("/api/cards")
@jwt_required()
def list_cards():
    params = CardQuerySchema().load(request.args.to_dict())
    cards = service.list_cards(current_user_id(), params)
    return success(CardOut(many=True).dump(cards))


@cards_bp.post("/api/columns/<uuid:column_id>/cards")
@jwt_required()
def create_card(column_id):
    data = CardSchema().load(request.get_json())
    card = service.create_card(current_user_id(), column_id, data)
    return success(CardOut().dump(card), 201)


@cards_bp.patch("/api/cards/<uuid:card_id>")
@jwt_required()
def update_card(card_id):
    data = CardUpdateSchema().load(request.get_json())
    card = service.update_card(current_user_id(), card_id, data)
    return success(CardOut().dump(card))


@cards_bp.delete("/api/cards/<uuid:card_id>")
@jwt_required()
def delete_card(card_id):
    deleted_id = service.soft_delete_card(current_user_id(), card_id)
    return success({"id": str(deleted_id)})


@cards_bp.patch("/api/cards/<uuid:card_id>/position")
@jwt_required()
def move_card(card_id):
    data = CardPositionSchema().load(request.get_json())
    result = service.move_card(current_user_id(), card_id, data)
    return success(CardMoveOut().dump(result))
