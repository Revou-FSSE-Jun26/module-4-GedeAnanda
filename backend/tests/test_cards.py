"""Card CRUD, soft delete, move, My Tasks and search (REQ-7, REQ-8, REQ-9, REQ-12, REQ-13)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import Board, BoardMember, Card, Notification, User
from tests.conftest import make_board
from tests.helpers import add_card, add_column, assert_error


@pytest.fixture
def todo(board):
    return add_column(board, "To Do", 1024)


@pytest.fixture
def done(board, todo):
    return add_column(board, "Done", 2048, is_done=True)


def create(client, headers, column, **body):
    return client.post(f"/api/columns/{column.id}/cards", json=body, headers=headers)


def move(client, headers, card, column, order):
    return client.patch(
        f"/api/cards/{card.id}/position",
        json={"column_id": str(column.id), "order": order},
        headers=headers,
    )


def card_titles(column_id):
    """Titles of the active cards in a column as stored, sorted by ``order``."""
    db.session.expire_all()
    rows = (
        db.session.query(Card)
        .filter_by(column_id=column_id, deleted_at=None)
        .order_by(Card.order)
    )
    return [card.title for card in rows]


def parse(timestamp):
    return datetime.fromisoformat(timestamp)


# --- POST /api/columns/<id>/cards ----------------------------------------------


def test_create_card_with_only_a_title_returns_201_with_defaults(
    client, board, todo, test_user_2, auth_headers
):
    res = create(client, auth_headers(test_user_2), todo, title="  Write tests ")

    assert res.status_code == 201
    assert res.get_json()["data"] == {
        "id": res.get_json()["data"]["id"],
        "column_id": str(todo.id),
        "board_id": str(board.id),
        "board_name": "Sprint Board",
        "title": "Write tests",
        "description": None,
        "priority": "medium",
        "due_date": None,
        "order": 1024,
        "completed_at": None,
        "created_by": str(test_user_2.id),
        "assignee": None,
    }


def test_create_card_with_all_fields(client, todo, test_user, test_user_2, auth_headers):
    res = create(
        client,
        auth_headers(test_user),
        todo,
        title="Ship it",
        description="Before Friday",
        assignee_id=str(test_user_2.id),
        due_date="2026-12-31",
        priority="high",
    )

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["description"] == "Before Friday"
    assert data["due_date"] == "2026-12-31"
    assert data["priority"] == "high"
    assert data["assignee"] == {"id": str(test_user_2.id), "name": "Bob Member"}


def test_new_card_goes_after_the_last_active_card(client, todo, test_user, auth_headers):
    add_card(todo, test_user, "First", 1024)
    add_card(todo, test_user, "Second", 3000)
    add_card(todo, test_user, "Deleted", 9000, deleted=True)

    res = create(client, auth_headers(test_user), todo, title="Third")

    assert res.get_json()["data"]["order"] == 4024


def test_card_order_is_counted_per_column(client, todo, done, test_user, auth_headers):
    add_card(done, test_user, "Elsewhere", 9000)

    res = create(client, auth_headers(test_user), todo, title="First here")

    assert res.get_json()["data"]["order"] == 1024


def test_card_created_in_a_done_column_is_completed(client, done, test_user, auth_headers):
    res = create(client, auth_headers(test_user), done, title="Already finished")

    assert res.get_json()["data"]["completed_at"] is not None


@pytest.mark.parametrize(
    "body, field",
    [
        ({}, "title"),
        ({"title": ""}, "title"),
        ({"title": "   "}, "title"),
        ({"title": "x" * 201}, "title"),
        ({"title": "ok", "description": "x" * 5001}, "description"),
        ({"title": "ok", "priority": "urgent"}, "priority"),
        ({"title": "ok", "due_date": "next week"}, "due_date"),
        ({"title": "ok", "assignee_id": "not-a-uuid"}, "assignee_id"),
    ],
)
def test_create_card_with_invalid_body_returns_400(
    client, todo, test_user, auth_headers, body, field
):
    res = create(client, auth_headers(test_user), todo, **body)

    assert assert_error(res, 400).startswith(f"{field}:")
    assert db.session.query(Card).count() == 0


def test_create_card_accepts_the_longest_allowed_values(client, todo, test_user, auth_headers):
    res = create(client, auth_headers(test_user), todo, title="x" * 200, description="y" * 5000)

    assert res.status_code == 201
    assert len(res.get_json()["data"]["description"]) == 5000


def test_create_card_with_assignee_outside_the_board_returns_400(
    client, todo, test_user, test_user_3, auth_headers
):
    res = create(client, auth_headers(test_user), todo, title="ok", assignee_id=str(test_user_3.id))

    assert assert_error(res, 400).startswith("assignee_id:")
    assert db.session.query(Card).count() == 0
    assert db.session.query(Notification).count() == 0


def test_create_card_without_token_returns_401(client, todo):
    assert_error(client.post(f"/api/columns/{todo.id}/cards", json={"title": "ok"}), 401)


def test_create_card_as_non_member_returns_same_404_as_unknown_column(
    client, todo, test_user_3, auth_headers
):
    headers = auth_headers(test_user_3)

    not_member = create(client, headers, todo, title="ok")
    unknown = client.post(f"/api/columns/{uuid.uuid4()}/cards", json={"title": "ok"}, headers=headers)

    assert assert_error(not_member, 404) == assert_error(unknown, 404)
    assert db.session.query(Card).count() == 0


# --- Notification N1 (REQ-11.1) ------------------------------------------------


def test_assigning_on_create_notifies_the_assignee(
    client, board, todo, test_user, test_user_2, auth_headers
):
    res = create(client, auth_headers(test_user), todo, title="Review PR", assignee_id=str(test_user_2.id))

    notification = db.session.query(Notification).one()
    assert notification.user_id == test_user_2.id
    assert notification.type == "card_assigned"
    assert str(notification.card_id) == res.get_json()["data"]["id"]
    assert notification.board_id == board.id
    assert "Review PR" in notification.message


def test_assigning_to_yourself_creates_no_notification(client, todo, test_user, auth_headers):
    create(client, auth_headers(test_user), todo, title="Mine", assignee_id=str(test_user.id))

    assert db.session.query(Notification).count() == 0


def test_changing_the_assignee_notifies_only_the_new_assignee(
    client, todo, test_user, test_user_2, auth_headers
):
    card = add_card(todo, test_user, "Task", 1024)
    headers = auth_headers(test_user)

    client.patch(f"/api/cards/{card.id}", json={"assignee_id": str(test_user_2.id)}, headers=headers)
    client.patch(f"/api/cards/{card.id}", json={"title": "Renamed"}, headers=headers)
    client.patch(f"/api/cards/{card.id}", json={"assignee_id": str(test_user_2.id)}, headers=headers)
    client.patch(f"/api/cards/{card.id}", json={"assignee_id": None}, headers=headers)

    assert [n.user_id for n in db.session.query(Notification)] == [test_user_2.id]


def test_moving_a_card_creates_no_notification(
    client, todo, done, test_user, test_user_2, auth_headers
):
    card = add_card(todo, test_user, "Task", 1024, assignee=test_user_2)

    move(client, auth_headers(test_user), card, done, 1024)

    assert db.session.query(Notification).count() == 0


# --- PATCH /api/cards/<id> -----------------------------------------------------


def test_update_card_changes_the_fields_sent(client, todo, test_user, test_user_2, auth_headers):
    card = add_card(todo, test_user, "Old title", 1024)

    res = client.patch(
        f"/api/cards/{card.id}",
        json={
            "title": "New title",
            "description": "Details",
            "assignee_id": str(test_user.id),
            "due_date": "2027-01-15",
            "priority": "low",
        },
        headers=auth_headers(test_user_2),
    )

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["id"] == str(card.id)
    assert data["title"] == "New title"
    assert data["description"] == "Details"
    assert data["assignee"] == {"id": str(test_user.id), "name": "Alice Admin"}
    assert data["due_date"] == "2027-01-15"
    assert data["priority"] == "low"
    assert data["order"] == 1024
    assert data["created_by"] == str(test_user.id)


def test_update_card_can_clear_optional_fields(client, todo, test_user, test_user_2, auth_headers):
    card = add_card(todo, test_user, "Task", 1024, assignee=test_user_2)
    card.description, card.due_date = "text", datetime(2027, 1, 1).date()
    db.session.commit()

    res = client.patch(
        f"/api/cards/{card.id}",
        json={"description": None, "assignee_id": None, "due_date": None},
        headers=auth_headers(test_user),
    )

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert (data["description"], data["assignee"], data["due_date"]) == (None, None, None)
    assert data["title"] == "Task"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"title": None},
        {"title": "x" * 201},
        {"description": "x" * 5001},
        {"priority": "urgent"},
        {"order": 5},
        {"column_id": str(uuid.uuid4())},
        {"created_by": str(uuid.uuid4())},
    ],
)
def test_update_card_with_invalid_body_returns_400(client, todo, test_user, auth_headers, body):
    card = add_card(todo, test_user, "Task", 1024)

    res = client.patch(f"/api/cards/{card.id}", json=body, headers=auth_headers(test_user))

    assert_error(res, 400)
    db.session.expire_all()
    assert (card.title, card.order, card.priority) == ("Task", 1024, "medium")


def test_update_card_with_assignee_outside_the_board_returns_400(
    client, todo, test_user, test_user_3, auth_headers
):
    card = add_card(todo, test_user, "Task", 1024)

    res = client.patch(
        f"/api/cards/{card.id}",
        json={"assignee_id": str(test_user_3.id)},
        headers=auth_headers(test_user),
    )

    assert assert_error(res, 400).startswith("assignee_id:")
    db.session.expire_all()
    assert card.assignee_id is None


def test_update_card_without_token_returns_401(client, todo, test_user):
    card = add_card(todo, test_user, "Task", 1024)

    assert_error(client.patch(f"/api/cards/{card.id}", json={"title": "x"}), 401)


def test_update_card_as_non_member_returns_same_404_as_unknown_card(
    client, todo, test_user, test_user_3, auth_headers
):
    card = add_card(todo, test_user, "Task", 1024)
    headers = auth_headers(test_user_3)

    not_member = client.patch(f"/api/cards/{card.id}", json={"title": "x"}, headers=headers)
    unknown = client.patch(f"/api/cards/{uuid.uuid4()}", json={"title": "x"}, headers=headers)

    assert assert_error(not_member, 404) == assert_error(unknown, 404)
    db.session.expire_all()
    assert card.title == "Task"


# --- DELETE /api/cards/<id> ----------------------------------------------------


def test_delete_card_by_creator_sets_deleted_at(client, todo, test_user_2, auth_headers):
    card = add_card(todo, test_user_2, "Mine", 1024)

    res = client.delete(f"/api/cards/{card.id}", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(card.id)}}
    db.session.expire_all()
    assert db.session.query(Card).count() == 1  # the row is kept
    assert card.deleted_at is not None
    assert card.deleted_at.tzinfo is not None


def test_delete_card_by_admin_who_is_not_the_creator_returns_200(
    client, todo, test_user, test_user_2, auth_headers
):
    card = add_card(todo, test_user_2, "Bob's", 1024)

    res = client.delete(f"/api/cards/{card.id}", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(card.id)}}
    db.session.expire_all()
    assert card.deleted_at is not None


def test_delete_card_by_member_who_is_not_the_creator_returns_403(
    client, todo, test_user, test_user_2, auth_headers
):
    card = add_card(todo, test_user, "Alice's", 1024)

    res = client.delete(f"/api/cards/{card.id}", headers=auth_headers(test_user_2))

    assert_error(res, 403)
    db.session.expire_all()
    assert card.deleted_at is None


def test_delete_card_as_non_member_returns_404(client, todo, test_user, test_user_3, auth_headers):
    card = add_card(todo, test_user, "Task", 1024)

    res = client.delete(f"/api/cards/{card.id}", headers=auth_headers(test_user_3))

    assert_error(res, 404)
    db.session.expire_all()
    assert card.deleted_at is None


def test_delete_card_without_token_returns_401(client, todo, test_user):
    card = add_card(todo, test_user, "Task", 1024)

    assert_error(client.delete(f"/api/cards/{card.id}"), 401)


# --- Property 3: a soft-deleted card is never returned (REQ-8.4, REQ-12.3) ------


@pytest.fixture
def deleted_card(client, todo, test_user, auth_headers):
    """A card assigned to Alice, soft-deleted through the API, next to one that stays."""
    add_card(todo, test_user, "Report kept", 1024, assignee=test_user)
    card = add_card(todo, test_user, "Report deleted", 2048, assignee=test_user)
    assert client.delete(f"/api/cards/{card.id}", headers=auth_headers(test_user)).status_code == 200
    return card


@pytest.mark.parametrize(
    "path",
    ["/api/cards?assignee=me", "/api/cards?board_id={board}", "/api/cards?board_id={board}&q=report"],
)
def test_property_3_deleted_card_is_not_listed(
    client, board, deleted_card, test_user, auth_headers, path
):
    res = client.get(path.format(board=board.id), headers=auth_headers(test_user))

    assert res.status_code == 200
    assert [card["title"] for card in res.get_json()["data"]] == ["Report kept"]


def test_property_3_deleted_card_is_not_in_the_board_detail(
    client, board, deleted_card, test_user, auth_headers
):
    res = client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user))

    cards = res.get_json()["data"]["columns"][0]["cards"]
    assert [card["title"] for card in cards] == ["Report kept"]


@pytest.mark.parametrize("method, suffix, body", [
    ("patch", "", {"title": "Back from the dead"}),
    ("delete", "", None),
    ("patch", "/position", {"column_id": "TODO", "order": 512}),
])
def test_property_3_deleted_card_cannot_be_changed(
    client, todo, deleted_card, test_user, auth_headers, method, suffix, body
):
    if body and body.get("column_id") == "TODO":
        body = {**body, "column_id": str(todo.id)}
    deleted_at = deleted_card.deleted_at

    res = getattr(client, method)(
        f"/api/cards/{deleted_card.id}{suffix}", json=body, headers=auth_headers(test_user)
    )

    assert_error(res, 404)
    db.session.expire_all()
    assert (deleted_card.title, deleted_card.order) == ("Report deleted", 2048)
    assert deleted_card.deleted_at == deleted_at


# --- GET /api/cards ------------------------------------------------------------


def test_my_tasks_returns_my_cards_across_my_boards(
    client, board, todo, test_user, test_user_2, auth_headers
):
    other_board = make_board(test_user_2, name="Another Board")
    other_column = add_column(other_board, "Backlog", 1024)
    add_card(todo, test_user, "Bob on sprint", 1024, assignee=test_user_2)
    add_card(todo, test_user, "Alice's", 2048, assignee=test_user)
    add_card(todo, test_user, "Nobody's", 3072)
    add_card(other_column, test_user_2, "Bob on another", 1024, assignee=test_user_2)

    res = client.get("/api/cards?assignee=me", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert [(card["board_name"], card["title"]) for card in data] == [
        ("Another Board", "Bob on another"),
        ("Sprint Board", "Bob on sprint"),
    ]
    assert data[1]["board_id"] == str(board.id)
    assert data[1]["assignee"] == {"id": str(test_user_2.id), "name": "Bob Member"}


def test_my_tasks_can_be_limited_to_one_board(client, board, todo, test_user_2, auth_headers):
    other_column = add_column(make_board(test_user_2, name="Another Board"), "Backlog", 1024)
    add_card(todo, test_user_2, "On sprint", 1024, assignee=test_user_2)
    add_card(other_column, test_user_2, "On another", 1024, assignee=test_user_2)

    res = client.get(f"/api/cards?assignee=me&board_id={board.id}", headers=auth_headers(test_user_2))

    assert [card["title"] for card in res.get_json()["data"]] == ["On sprint"]


def test_my_tasks_hides_cards_on_a_board_i_was_removed_from(
    client, board, todo, test_user, test_user_2, auth_headers
):
    add_card(todo, test_user, "Left behind", 1024, assignee=test_user_2)
    db.session.query(BoardMember).filter_by(board_id=board.id, user_id=test_user_2.id).delete()
    db.session.commit()

    res = client.get("/api/cards?assignee=me", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    assert res.get_json() == {"data": []}


def test_list_cards_uses_a_fixed_number_of_queries(
    client, board, test_user, test_user_2, auth_headers, count_queries
):
    headers = auth_headers(test_user)
    url = f"/api/cards?board_id={board.id}"
    board_id, user_ids = board.id, [test_user.id, test_user_2.id]

    def add_columns(first, last):
        users = [db.session.get(User, user_id) for user_id in user_ids]
        for index in range(first, last + 1):
            column = add_column(db.session.get(Board, board_id), f"Column {index}", index * 1024)
            for position in range(1, 4):
                add_card(column, users[0], f"Card {position}", position * 1024,
                         assignee=users[position % 2])
        db.session.expunge_all()  # an empty session, as at the start of a real request

    add_columns(1, 1)
    _, small = count_queries(lambda: client.get(url, headers=headers))
    add_columns(2, 5)
    res, large = count_queries(lambda: client.get(url, headers=headers))

    assert len(res.get_json()["data"]) == 15
    assert small == 3  # membership; cards with column and board; assignees
    assert large == small


def test_search_matches_title_case_insensitively(client, board, todo, test_user, auth_headers):
    add_card(todo, test_user, "Fix LOGIN bug", 1024)
    add_card(todo, test_user, "Write login docs", 2048)
    add_card(todo, test_user, "Deploy", 3072)

    res = client.get(f"/api/cards?board_id={board.id}&q=Login", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert [card["title"] for card in res.get_json()["data"]] == ["Fix LOGIN bug", "Write login docs"]


@pytest.mark.parametrize("term, expected", [("100%", ["100% done"]), ("a_b", ["a_b literal"])])
def test_search_treats_wildcards_in_the_term_literally(
    client, board, todo, test_user, auth_headers, term, expected
):
    add_card(todo, test_user, "100% done", 1024)
    add_card(todo, test_user, "1000 things", 2048)
    add_card(todo, test_user, "a_b literal", 3072)
    add_card(todo, test_user, "axb other", 4096)

    res = client.get("/api/cards", query_string={"board_id": str(board.id), "q": term},
                     headers=auth_headers(test_user))

    assert [card["title"] for card in res.get_json()["data"]] == expected


def test_search_does_not_return_cards_from_other_boards(
    client, board, todo, test_user, auth_headers
):
    other_column = add_column(make_board(test_user, name="Other"), "Backlog", 1024)
    add_card(todo, test_user, "Login here", 1024)
    add_card(other_column, test_user, "Login elsewhere", 1024)

    res = client.get(f"/api/cards?board_id={board.id}&q=login", headers=auth_headers(test_user))

    assert [card["title"] for card in res.get_json()["data"]] == ["Login here"]


def test_list_cards_of_a_board_returns_them_in_column_then_card_order(
    client, board, todo, done, test_user, auth_headers
):
    add_card(done, test_user, "Finished", 1024)
    add_card(todo, test_user, "Second", 2048)
    add_card(todo, test_user, "First", 1024)

    res = client.get(f"/api/cards?board_id={board.id}", headers=auth_headers(test_user))

    assert [card["title"] for card in res.get_json()["data"]] == ["First", "Second", "Finished"]


@pytest.mark.parametrize("query", ["", "?q=login", "?assignee=bob", "?board_id=not-a-uuid"])
def test_list_cards_with_invalid_query_returns_400(client, test_user, auth_headers, query):
    assert_error(client.get(f"/api/cards{query}", headers=auth_headers(test_user)), 400)


def test_list_cards_of_a_board_as_non_member_returns_404(
    client, board, todo, test_user, test_user_3, auth_headers
):
    add_card(todo, test_user, "Secret", 1024)

    res = client.get(f"/api/cards?board_id={board.id}", headers=auth_headers(test_user_3))

    assert_error(res, 404)


def test_list_cards_without_token_returns_401(client):
    assert_error(client.get("/api/cards?assignee=me"), 401)


# --- PATCH /api/cards/<id>/position --------------------------------------------


def test_move_card_to_another_column_returns_200(
    client, todo, test_user, test_user_2, auth_headers, board
):
    doing = add_column(board, "Doing", 1536)
    card = add_card(todo, test_user, "Task", 1024)

    res = move(client, auth_headers(test_user_2), card, doing, 1024)

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["card"]["id"] == str(card.id)
    assert data["card"]["column_id"] == str(doing.id)
    assert data["card"]["order"] == 1024
    assert data["card"]["completed_at"] is None
    assert data["rebalanced"] is False
    assert data["column_orders"] == []
    db.session.expire_all()
    assert card.column_id == doing.id


def test_move_card_to_a_column_on_another_board_returns_400(
    client, todo, test_user, auth_headers
):
    foreign = add_column(make_board(test_user, name="Other"), "Backlog", 1024)
    card = add_card(todo, test_user, "Task", 1024)

    res = move(client, auth_headers(test_user), card, foreign, 1024)

    assert assert_error(res, 400).startswith("column_id:")
    db.session.expire_all()
    assert card.column_id == todo.id


@pytest.mark.parametrize(
    "body, field",
    [
        ({"column_id": str(uuid.uuid4()), "order": 512}, "column_id"),
        ({"column_id": "not-a-uuid", "order": 512}, "column_id"),
        ({"order": 512}, "column_id"),
        ({"column_id": "TODO", "order": 0}, "order"),
        ({"column_id": "TODO", "order": -1}, "order"),
        ({"column_id": "TODO", "order": "top"}, "order"),
        ({"column_id": "TODO"}, "order"),
    ],
)
def test_move_card_with_invalid_body_returns_400(
    client, todo, test_user, auth_headers, body, field
):
    card = add_card(todo, test_user, "Task", 1024)
    if body.get("column_id") == "TODO":
        body = {**body, "column_id": str(todo.id)}

    res = client.patch(f"/api/cards/{card.id}/position", json=body, headers=auth_headers(test_user))

    assert assert_error(res, 400).startswith(f"{field}:")
    db.session.expire_all()
    assert (card.column_id, card.order) == (todo.id, 1024)


def test_move_card_as_non_member_returns_404(client, todo, test_user, test_user_3, auth_headers):
    card = add_card(todo, test_user, "Task", 1024)

    res = move(client, auth_headers(test_user_3), card, todo, 512)

    assert_error(res, 404)
    db.session.expire_all()
    assert card.order == 1024


def test_move_card_without_token_returns_401(client, todo, test_user):
    card = add_card(todo, test_user, "Task", 1024)

    res = client.patch(
        f"/api/cards/{card.id}/position", json={"column_id": str(todo.id), "order": 512}
    )

    assert_error(res, 401)


# --- Property 4: completed_at follows the column (REQ-9.4, REQ-9.5) -------------


def test_moving_into_a_done_column_sets_completed_at_to_now(
    client, todo, done, test_user, auth_headers
):
    card = add_card(todo, test_user, "Task", 1024)
    before = datetime.now(timezone.utc)

    res = move(client, auth_headers(test_user), card, done, 1024)

    completed_at = parse(res.get_json()["data"]["card"]["completed_at"])
    assert before - timedelta(seconds=1) <= completed_at <= datetime.now(timezone.utc)


@pytest.mark.parametrize("round_trips", [1, 2, 3])
def test_property_4_moving_back_out_clears_completed_at(
    client, todo, done, test_user, auth_headers, round_trips
):
    card = add_card(todo, test_user, "Task", 1024)
    headers = auth_headers(test_user)

    for _ in range(round_trips):
        into_done = move(client, headers, card, done, 1024)
        assert into_done.get_json()["data"]["card"]["completed_at"] is not None
        back = move(client, headers, card, todo, 1024)
        assert back.get_json()["data"]["card"]["completed_at"] is None

    db.session.expire_all()
    assert card.completed_at is None


def test_reordering_inside_a_done_column_keeps_completed_at(
    client, done, test_user, auth_headers
):
    card = add_card(done, test_user, "Task", 1024)
    finished = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
    card.completed_at = finished
    db.session.commit()

    res = move(client, auth_headers(test_user), card, done, 4096)

    assert parse(res.get_json()["data"]["card"]["completed_at"]) == finished


# --- Property 1 and 2: FLOAT order for cards (REQ-9.6) --------------------------


@pytest.fixture
def four_cards(todo, test_user):
    """A(1024) B(2048) C(3072) in To Do, and D to be moved."""
    cards = [add_card(todo, test_user, name, (i + 1) * 1024) for i, name in enumerate("ABC")]
    return cards + [add_card(todo, test_user, "D", 4096)]


@pytest.mark.parametrize(
    "target, expected",
    [
        ("top", ["D", "A", "B", "C"]),
        ("between A and B", ["A", "D", "B", "C"]),
        ("between B and C", ["A", "B", "D", "C"]),
        ("end", ["A", "B", "C", "D"]),
    ],
)
def test_property_1_card_lands_at_the_intended_position(
    client, todo, test_user, auth_headers, four_cards, target, expected
):
    a, b, c, d = four_cards
    order = {
        "top": a.order / 2,
        "between A and B": (a.order + b.order) / 2,
        "between B and C": (b.order + c.order) / 2,
        "end": c.order + 1024,
    }[target]

    res = move(client, auth_headers(test_user), d, todo, order)

    assert res.status_code == 200
    assert res.get_json()["data"]["rebalanced"] is False
    assert card_titles(todo.id) == expected


def test_property_1_card_moved_into_another_column_lands_between_its_cards(
    client, todo, done, test_user, auth_headers, four_cards
):
    add_card(done, test_user, "X", 1024)
    add_card(done, test_user, "Y", 2048)

    move(client, auth_headers(test_user), four_cards[3], done, 1536)

    assert card_titles(done.id) == ["X", "D", "Y"]
    assert card_titles(todo.id) == ["A", "B", "C"]


@pytest.mark.parametrize(
    "orders, moved, new_order, expected",
    [
        ([1024, 1024.0000008, 3072, 4096], "D", 1024.0000004, ["A", "D", "B", "C"]),
        ([0.000003, 2048, 3072, 4096], "D", 0.0000005, ["D", "A", "B", "C"]),
        ([1024, 2048, 3072, 4096], "A", 3072.0000001, ["B", "C", "A", "D"]),
    ],
)
def test_property_2_card_rebalance_keeps_relative_order(
    client, todo, done, test_user, auth_headers, orders, moved, new_order, expected
):
    cards = {name: add_card(todo, test_user, name, order) for name, order in zip("ABCD", orders)}
    deleted = add_card(todo, test_user, "Deleted", 1024.0000001, deleted=True)
    elsewhere = add_card(done, test_user, "Elsewhere", 1024.0000002)

    res = move(client, auth_headers(test_user), cards[moved], todo, new_order)

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["rebalanced"] is True
    assert data["column_orders"] == [
        {"id": str(cards[name].id), "order": (index + 1) * 1024}
        for index, name in enumerate(expected)
    ]
    assert data["card"]["order"] == (expected.index(moved) + 1) * 1024
    assert card_titles(todo.id) == expected
    db.session.expire_all()
    assert deleted.order == 1024.0000001  # deleted cards are left alone
    assert elsewhere.order == 1024.0000002  # so are other columns
