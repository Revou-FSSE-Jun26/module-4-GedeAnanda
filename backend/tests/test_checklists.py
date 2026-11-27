"""Card checklists (REQ-35)."""

import uuid
from datetime import datetime, timezone

import pytest

from app.extensions import db
from app.models import ChecklistItem
from tests.helpers import add_card, add_column, add_item, assert_error


@pytest.fixture
def card(board, test_user):
    """A card created by Alice (admin) on the board. Bob is a member, Carol is not."""
    return add_card(add_column(board, "To Do", 1024), test_user, "Write docs", 1024)


def add(client, headers, card_id, **body):
    return client.post(f"/api/cards/{card_id}/checklist", json=body, headers=headers)


def soft_delete(card):
    card.deleted_at = datetime.now(timezone.utc)
    db.session.commit()


# --- POST /api/cards/<id>/checklist ------------------------------------------------


def test_member_adds_an_item_that_starts_not_done(client, card, test_user_2, auth_headers):
    res = add(client, auth_headers(test_user_2), card.id, text="  Outline the page ")

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data == {"id": data["id"], "card_id": str(card.id), "text": "Outline the page", "is_done": False}


def test_items_come_back_on_the_card_in_the_order_they_were_added(
    client, board, card, test_user, auth_headers
):
    headers = auth_headers(test_user)
    for text in ("First", "Second", "Third"):
        add(client, headers, card.id, text=text)

    board_data = client.get(f"/api/boards/{board.id}", headers=headers).get_json()["data"]

    checklist = board_data["columns"][0]["cards"][0]["checklist"]
    assert [item["text"] for item in checklist] == ["First", "Second", "Third"]
    assert set(checklist[0]) == {"id", "text", "is_done"}


@pytest.mark.parametrize(
    "body",
    [{}, {"text": "   "}, {"text": "x" * 301}, {"text": "ok", "is_done": True}],
    ids=["no text", "blank text", "text too long", "is_done on create"],
)
def test_add_item_rejects_invalid_input(client, card, test_user, auth_headers, body):
    assert_error(add(client, auth_headers(test_user), card.id, **body), 400)
    assert db.session.query(ChecklistItem).count() == 0


def test_a_text_of_exactly_300_characters_is_accepted(client, card, test_user, auth_headers):
    assert add(client, auth_headers(test_user), card.id, text="x" * 300).status_code == 201


def test_non_member_cannot_add_an_item(client, card, test_user_3, auth_headers):
    message = assert_error(add(client, auth_headers(test_user_3), card.id, text="Sneaky"), 404)

    assert message == "Card not found"
    assert db.session.query(ChecklistItem).count() == 0


def test_cannot_add_an_item_to_a_deleted_card(client, card, test_user, auth_headers):
    soft_delete(card)

    assert_error(add(client, auth_headers(test_user), card.id, text="Late"), 404)


def test_add_item_requires_a_token(client, card):
    assert_error(client.post(f"/api/cards/{card.id}/checklist", json={"text": "x"}), 401)


# --- PATCH /api/checklist-items/<id> -------------------------------------------------


def test_member_ticks_an_item(client, card, test_user_2, auth_headers):
    item = add_item(card, "Outline", 1024)

    res = client.patch(
        f"/api/checklist-items/{item.id}", json={"is_done": True}, headers=auth_headers(test_user_2)
    )

    assert res.status_code == 200
    assert res.get_json()["data"] == {
        "id": str(item.id), "card_id": str(card.id), "text": "Outline", "is_done": True,
    }


def test_an_item_can_be_unticked_and_renamed_together(client, card, test_user, auth_headers):
    item = add_item(card, "Outline", 1024, is_done=True)

    res = client.patch(
        f"/api/checklist-items/{item.id}",
        json={"is_done": False, "text": " Draft "},
        headers=auth_headers(test_user),
    )

    assert (res.get_json()["data"]["text"], res.get_json()["data"]["is_done"]) == ("Draft", False)


@pytest.mark.parametrize(
    "body", [{}, {"text": ""}, {"is_done": "maybe"}, {"card_id": str(uuid.uuid4())}],
    ids=["empty", "blank text", "is_done not a boolean", "unknown field"],
)
def test_update_item_rejects_invalid_input(client, card, test_user, auth_headers, body):
    item = add_item(card, "Outline", 1024)

    assert_error(client.patch(f"/api/checklist-items/{item.id}", json=body, headers=auth_headers(test_user)), 400)
    assert (item.text, item.is_done) == ("Outline", False)


def test_unknown_item_someone_elses_item_and_item_on_a_deleted_card_give_the_same_404(
    client, board, card, test_user, test_user_3, auth_headers
):
    item = add_item(card, "Outline", 1024)
    gone = add_card(db.session.get(type(card.column), card.column_id), test_user, "Gone", 2048)
    orphan = add_item(gone, "On a deleted card", 1024)
    soft_delete(gone)
    body = {"is_done": True}

    hidden = assert_error(
        client.patch(f"/api/checklist-items/{item.id}", json=body, headers=auth_headers(test_user_3)), 404
    )
    missing = assert_error(
        client.patch(f"/api/checklist-items/{uuid.uuid4()}", json=body, headers=auth_headers(test_user)), 404
    )
    deleted = assert_error(
        client.patch(f"/api/checklist-items/{orphan.id}", json=body, headers=auth_headers(test_user)), 404
    )

    assert hidden == missing == deleted == "Checklist item not found"
    assert db.session.get(ChecklistItem, item.id).is_done is False


# --- DELETE /api/checklist-items/<id> --------------------------------------------------


def test_member_deletes_an_item_and_the_others_stay(client, card, test_user_2, auth_headers):
    first, second = add_item(card, "First", 1024), add_item(card, "Second", 2048)
    first_id = first.id

    res = client.delete(f"/api/checklist-items/{first_id}", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(first_id)}}
    assert [item.id for item in db.session.query(ChecklistItem)] == [second.id]


def test_non_member_cannot_delete_an_item(client, card, test_user_3, auth_headers):
    item = add_item(card, "Outline", 1024)

    assert_error(client.delete(f"/api/checklist-items/{item.id}", headers=auth_headers(test_user_3)), 404)
    assert db.session.query(ChecklistItem).count() == 1


def test_an_item_added_after_a_delete_still_goes_last(client, board, card, test_user, auth_headers):
    headers = auth_headers(test_user)
    add_item(card, "First", 1024)
    last = add_item(card, "Second", 2048)
    client.delete(f"/api/checklist-items/{last.id}", headers=headers)

    add(client, headers, card.id, text="Third")

    board_data = client.get(f"/api/boards/{board.id}", headers=headers).get_json()["data"]
    assert [item["text"] for item in board_data["columns"][0]["cards"][0]["checklist"]] == ["First", "Third"]


def test_deleting_the_column_removes_its_cards_checklists(client, board, card, test_user, auth_headers):
    add_item(card, "Outline", 1024)

    res = client.delete(f"/api/columns/{card.column_id}", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert db.session.query(ChecklistItem).count() == 0


# --- order ------------------------------------------------------------------------------


def checklist_texts(client, headers, board):
    board_data = client.get(f"/api/boards/{board.id}", headers=headers).get_json()["data"]
    return [item["text"] for item in board_data["columns"][0]["cards"][0]["checklist"]]


def test_items_are_returned_by_their_order_not_by_when_they_were_stored(
    client, board, card, test_user, auth_headers
):
    add_item(card, "Stored first, placed second", 2048)
    add_item(card, "Stored second, placed first", 1024)

    assert checklist_texts(client, auth_headers(test_user), board) == [
        "Stored second, placed first",
        "Stored first, placed second",
    ]


def test_a_new_item_is_placed_after_the_highest_existing_order(
    client, board, card, test_user, auth_headers
):
    headers = auth_headers(test_user)
    add_item(card, "Existing", 5000)

    add(client, headers, card.id, text="New")

    assert checklist_texts(client, headers, board) == ["Existing", "New"]
