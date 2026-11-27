"""Board labels and labels on cards (REQ-34)."""

import uuid

import pytest

from app.extensions import db
from app.models import CardLabel, Label
from tests.conftest import make_board
from tests.helpers import add_card, add_column, add_label, assert_error, tag


@pytest.fixture
def card(board, test_user):
    """A card created by Alice (admin) on the board. Bob is a member, Carol is not."""
    return add_card(add_column(board, "To Do", 1024), test_user, "Write docs", 1024)


def create(client, headers, board_id, **body):
    return client.post(f"/api/boards/{board_id}/labels", json=body, headers=headers)


# --- POST /api/boards/<id>/labels ------------------------------------------------


def test_member_creates_a_label(client, board, test_user_2, auth_headers):
    res = create(client, auth_headers(test_user_2), board.id, name="  Bug ", color="poppy")

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data == {"id": data["id"], "name": "Bug", "color": "poppy"}
    assert db.session.query(Label).one().board_id == board.id


@pytest.mark.parametrize(
    "body",
    [
        {"color": "teal"},
        {"name": "   ", "color": "teal"},
        {"name": "x" * 41, "color": "teal"},
        {"name": "Bug"},
        {"name": "Bug", "color": "pink"},
        {"name": "Bug", "color": "teal", "owner": str(uuid.uuid4())},
    ],
    ids=["no name", "blank name", "name too long", "no color", "unknown color", "unknown field"],
)
def test_create_label_rejects_invalid_input(client, board, test_user, auth_headers, body):
    assert_error(create(client, auth_headers(test_user), board.id, **body), 400)
    assert db.session.query(Label).count() == 0


def test_a_name_of_exactly_40_characters_is_accepted(client, board, test_user, auth_headers):
    res = create(client, auth_headers(test_user), board.id, name="x" * 40, color="moss")

    assert res.status_code == 201


def test_duplicate_name_on_the_same_board_returns_409_whatever_the_case(
    client, board, test_user, auth_headers
):
    add_label(board, "Bug")

    res = create(client, auth_headers(test_user), board.id, name="bUG", color="teal")

    assert_error(res, 409)
    assert db.session.query(Label).count() == 1


def test_the_same_name_is_allowed_on_another_board(client, board, test_user, auth_headers):
    add_label(board, "Bug")
    other = make_board(test_user, "Other board")

    res = create(client, auth_headers(test_user), other.id, name="Bug", color="teal")

    assert res.status_code == 201


def test_non_member_cannot_create_a_label(client, board, test_user_3, auth_headers):
    message = assert_error(create(client, auth_headers(test_user_3), board.id, name="Bug", color="teal"), 404)

    assert message == "Board not found"
    assert db.session.query(Label).count() == 0


def test_create_label_requires_a_token(client, board):
    assert_error(client.post(f"/api/boards/{board.id}/labels", json={"name": "Bug", "color": "teal"}), 401)


# --- GET /api/boards/<id>/labels ---------------------------------------------------


def test_list_labels_is_sorted_by_name_and_limited_to_the_board(
    client, board, test_user, test_user_2, auth_headers
):
    add_label(board, "Feature", "teal")
    add_label(board, "Bug", "poppy")
    add_label(make_board(test_user, "Other board"), "Elsewhere")

    res = client.get(f"/api/boards/{board.id}/labels", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    assert [(item["name"], item["color"]) for item in res.get_json()["data"]] == [
        ("Bug", "poppy"),
        ("Feature", "teal"),
    ]


def test_list_labels_of_a_board_without_labels_is_empty(client, board, test_user, auth_headers):
    res = client.get(f"/api/boards/{board.id}/labels", headers=auth_headers(test_user))

    assert res.get_json() == {"data": []}


def test_non_member_cannot_list_labels(client, board, test_user_3, auth_headers):
    assert_error(client.get(f"/api/boards/{board.id}/labels", headers=auth_headers(test_user_3)), 404)


# --- PATCH /api/labels/<id> ----------------------------------------------------------


def test_member_renames_and_recolours_a_label(client, board, test_user_2, auth_headers):
    label = add_label(board, "Bug", "poppy")

    res = client.patch(
        f"/api/labels/{label.id}", json={"name": "Defect", "color": "plum"}, headers=auth_headers(test_user_2)
    )

    assert res.status_code == 200
    assert res.get_json()["data"] == {"id": str(label.id), "name": "Defect", "color": "plum"}


def test_update_label_can_change_only_the_colour(client, board, test_user, auth_headers):
    label = add_label(board, "Bug", "poppy")

    res = client.patch(f"/api/labels/{label.id}", json={"color": "amber"}, headers=auth_headers(test_user))

    assert res.get_json()["data"] == {"id": str(label.id), "name": "Bug", "color": "amber"}


def test_a_label_may_keep_its_own_name_in_another_case(client, board, test_user, auth_headers):
    label = add_label(board, "bug")

    res = client.patch(f"/api/labels/{label.id}", json={"name": "Bug"}, headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json()["data"]["name"] == "Bug"


def test_renaming_to_another_labels_name_returns_409(client, board, test_user, auth_headers):
    add_label(board, "Bug")
    feature = add_label(board, "Feature")

    res = client.patch(f"/api/labels/{feature.id}", json={"name": "BUG"}, headers=auth_headers(test_user))

    assert_error(res, 409)
    assert db.session.get(Label, feature.id).name == "Feature"


@pytest.mark.parametrize("body", [{}, {"name": ""}, {"color": "pink"}], ids=["empty", "blank name", "bad color"])
def test_update_label_rejects_invalid_input(client, board, test_user, auth_headers, body):
    label = add_label(board, "Bug", "poppy")

    assert_error(client.patch(f"/api/labels/{label.id}", json=body, headers=auth_headers(test_user)), 400)
    assert (label.name, label.color) == ("Bug", "poppy")


def test_unknown_label_and_someone_elses_label_give_the_same_404(
    client, board, test_user_3, auth_headers
):
    label = add_label(board, "Bug")
    headers = auth_headers(test_user_3)

    hidden = assert_error(client.patch(f"/api/labels/{label.id}", json={"name": "X"}, headers=headers), 404)
    missing = assert_error(client.patch(f"/api/labels/{uuid.uuid4()}", json={"name": "X"}, headers=headers), 404)

    assert hidden == missing == "Label not found"
    assert db.session.get(Label, label.id).name == "Bug"


# --- DELETE /api/labels/<id> ---------------------------------------------------------


def test_admin_deletes_a_label_and_it_leaves_its_cards(client, board, card, test_user, auth_headers):
    label = add_label(board, "Bug")
    tag(card, label)
    label_id, card_id = label.id, card.id

    res = client.delete(f"/api/labels/{label_id}", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(label_id)}}
    assert db.session.query(Label).count() == 0
    assert db.session.query(CardLabel).count() == 0
    board_data = client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user)).get_json()["data"]
    assert board_data["labels"] == []
    assert board_data["columns"][0]["cards"][0]["id"] == str(card_id)
    assert board_data["columns"][0]["cards"][0]["labels"] == []


def test_member_cannot_delete_a_label(client, board, test_user_2, auth_headers):
    label = add_label(board, "Bug")

    assert_error(client.delete(f"/api/labels/{label.id}", headers=auth_headers(test_user_2)), 403)
    assert db.session.query(Label).count() == 1


def test_non_member_deleting_a_label_gets_404_not_403(client, board, test_user_3, auth_headers):
    label = add_label(board, "Bug")

    message = assert_error(client.delete(f"/api/labels/{label.id}", headers=auth_headers(test_user_3)), 404)

    assert message == "Label not found"
    assert db.session.query(Label).count() == 1


# --- label_ids on cards -----------------------------------------------------------------


def test_create_card_with_labels_returns_them_sorted_by_name(client, board, card, test_user, auth_headers):
    feature = add_label(board, "Feature", "teal")
    bug = add_label(board, "Bug", "poppy")

    res = client.post(
        f"/api/columns/{card.column_id}/cards",
        json={"title": "Fix login", "label_ids": [str(feature.id), str(bug.id)]},
        headers=auth_headers(test_user),
    )

    assert res.status_code == 201
    assert res.get_json()["data"]["labels"] == [
        {"id": str(bug.id), "name": "Bug", "color": "poppy"},
        {"id": str(feature.id), "name": "Feature", "color": "teal"},
    ]


def test_update_card_sets_its_labels_to_exactly_the_list(client, board, card, test_user_2, auth_headers):
    bug, feature, chore = add_label(board, "Bug"), add_label(board, "Feature"), add_label(board, "Chore")
    tag(card, bug)
    tag(card, feature)
    headers = auth_headers(test_user_2)

    res = client.patch(
        f"/api/cards/{card.id}", json={"label_ids": [str(feature.id), str(chore.id)]}, headers=headers
    )

    assert res.status_code == 200
    assert [item["name"] for item in res.get_json()["data"]["labels"]] == ["Chore", "Feature"]
    assert db.session.query(CardLabel).count() == 2


def test_an_empty_list_removes_every_label_from_the_card(client, board, card, test_user, auth_headers):
    tag(card, add_label(board, "Bug"))

    res = client.patch(f"/api/cards/{card.id}", json={"label_ids": []}, headers=auth_headers(test_user))

    assert res.get_json()["data"]["labels"] == []
    assert db.session.query(CardLabel).count() == 0
    assert db.session.query(Label).count() == 1  # the label itself stays on the board


def test_updating_another_field_leaves_the_labels_alone(client, board, card, test_user, auth_headers):
    tag(card, add_label(board, "Bug"))

    res = client.patch(f"/api/cards/{card.id}", json={"title": "Renamed"}, headers=auth_headers(test_user))

    assert [item["name"] for item in res.get_json()["data"]["labels"]] == ["Bug"]


def test_a_repeated_label_id_is_stored_once(client, board, card, test_user, auth_headers):
    bug = add_label(board, "Bug")

    res = client.patch(
        f"/api/cards/{card.id}", json={"label_ids": [str(bug.id), str(bug.id)]}, headers=auth_headers(test_user)
    )

    assert res.status_code == 200
    assert len(res.get_json()["data"]["labels"]) == 1


def test_a_label_of_another_board_is_rejected_and_the_card_is_unchanged(
    client, board, card, test_user, auth_headers
):
    mine = add_label(board, "Bug")
    tag(card, mine)
    foreign = add_label(make_board(test_user, "Other board"), "Elsewhere")

    res = client.patch(
        f"/api/cards/{card.id}",
        json={"title": "Changed", "label_ids": [str(mine.id), str(foreign.id)]},
        headers=auth_headers(test_user),
    )

    assert_error(res, 400)
    db.session.expire_all()
    assert card.title == "Write docs"
    assert [link.label_id for link in card.label_links] == [mine.id]


def test_an_unknown_label_id_is_rejected_on_create(client, card, test_user, auth_headers):
    res = client.post(
        f"/api/columns/{card.column_id}/cards",
        json={"title": "New", "label_ids": [str(uuid.uuid4())]},
        headers=auth_headers(test_user),
    )

    assert_error(res, 400)
    assert db.session.query(CardLabel).count() == 0


def test_label_ids_that_are_not_uuids_return_400(client, card, test_user, auth_headers):
    res = client.patch(f"/api/cards/{card.id}", json={"label_ids": ["bug"]}, headers=auth_headers(test_user))

    assert_error(res, 400)


def test_deleting_the_board_removes_its_labels_and_card_links(client, board, card, test_user, auth_headers):
    tag(card, add_label(board, "Bug"))

    res = client.delete(f"/api/boards/{board.id}", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert db.session.query(Label).count() == 0
    assert db.session.query(CardLabel).count() == 0
