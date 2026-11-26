"""Board CRUD and member management (REQ-5, REQ-16, REQ-11.3)."""

import uuid

import pytest
from app.extensions import db
from app.models import Board, BoardColumn, BoardMember, Card, Comment, Notification, User
from tests.conftest import make_board
from tests.helpers import add_card, add_column, assert_error


# --- POST /api/boards ----------------------------------------------------------


def test_create_board_returns_201_and_makes_creator_admin(client, test_user, auth_headers):
    res = client.post("/api/boards", json={"name": "Roadmap"}, headers=auth_headers(test_user))

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert set(data) == {"id", "name", "role", "created_at"}
    assert data["name"] == "Roadmap"
    assert data["role"] == "admin"
    membership = db.session.query(BoardMember).filter_by(board_id=uuid.UUID(data["id"])).one()
    assert membership.user_id == test_user.id
    assert membership.role == "admin"


@pytest.mark.parametrize("body", [{}, {"name": ""}, {"name": "   "}, {"name": "x" * 101}])
def test_create_board_with_invalid_name_returns_400(client, test_user, auth_headers, body):
    res = client.post("/api/boards", json=body, headers=auth_headers(test_user))

    assert assert_error(res, 400).startswith("name:")
    assert db.session.query(Board).count() == 0


def test_create_board_without_token_returns_401(client):
    assert_error(client.post("/api/boards", json={"name": "Roadmap"}), 401)


# --- GET /api/boards -----------------------------------------------------------


def test_list_boards_returns_only_the_users_boards_with_their_role(
    client, board, test_user, test_user_2, test_user_3, auth_headers
):
    make_board(test_user_3, name="Carol's private board")
    bobs = make_board(test_user_2, name="Bob's board")

    res = client.get("/api/boards", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert [(item["id"], item["role"]) for item in data] == [
        (str(board.id), "member"),
        (str(bobs.id), "admin"),
    ]


def test_list_boards_is_empty_for_a_user_without_boards(client, board, test_user_3, auth_headers):
    res = client.get("/api/boards", headers=auth_headers(test_user_3))

    assert res.status_code == 200
    assert res.get_json() == {"data": []}


def test_list_boards_without_token_returns_401(client):
    assert_error(client.get("/api/boards"), 401)


# --- GET /api/boards/<id> ------------------------------------------------------


def test_get_board_returns_ordered_columns_and_active_cards(
    client, board, test_user, test_user_2, auth_headers
):
    done = add_column(board, "Done", 2048, is_done=True)
    todo = add_column(board, "To Do", 1024)
    add_card(todo, test_user, "Second", 2048)
    first = add_card(todo, test_user, "First", 1024, assignee=test_user_2)
    add_card(todo, test_user, "Deleted", 512, deleted=True)

    res = client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["id"] == str(board.id)
    assert data["name"] == "Sprint Board"
    assert data["role"] == "member"
    assert [column["name"] for column in data["columns"]] == ["To Do", "Done"]
    assert data["columns"][1]["id"] == str(done.id)
    assert data["columns"][1]["is_done"] is True
    assert data["columns"][1]["cards"] == []
    cards = data["columns"][0]["cards"]
    assert [card["title"] for card in cards] == ["First", "Second"]
    assert cards[0]["id"] == str(first.id)
    assert cards[0]["board_id"] == str(board.id)
    assert cards[0]["board_name"] == "Sprint Board"
    assert cards[0]["assignee"] == {"id": str(test_user_2.id), "name": "Bob Member"}
    assert cards[1]["assignee"] is None


def test_get_board_uses_a_fixed_number_of_queries(
    client, board, test_user, test_user_2, auth_headers, count_queries
):
    headers = auth_headers(test_user)
    url = f"/api/boards/{board.id}"
    board_id, user_ids = board.id, [test_user.id, test_user_2.id]
    column = add_column(board, "To Do", 1024)
    add_card(column, test_user, "Only card", 1024, assignee=test_user_2)

    # An empty session, as in production, so nothing is answered from memory.
    db.session.expunge_all()
    _, small = count_queries(lambda: client.get(url, headers=headers))

    board = db.session.get(Board, board_id)
    users = [db.session.get(User, user_id) for user_id in user_ids]
    for index in range(2, 6):
        extra = add_column(board, f"Column {index}", index * 1024)
        for position in range(1, 5):
            add_card(
                extra, users[0], f"Card {position}", position * 1024,
                assignee=users[position % 2],
            )
    db.session.expunge_all()

    res, large = count_queries(lambda: client.get(url, headers=headers))

    assert sum(len(c["cards"]) for c in res.get_json()["data"]["columns"]) == 17
    assert small == 5  # membership, board, columns, cards, assignees
    assert large == small


def test_get_board_hides_deleted_cards_already_loaded_in_the_session(
    client, board, test_user, auth_headers
):
    column = add_column(board, "To Do", 1024)
    add_card(column, test_user, "Kept", 1024)
    add_card(column, test_user, "Deleted", 2048, deleted=True)
    assert len(column.cards) == 2  # the unfiltered collection is now cached in the session

    res = client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user))

    assert [card["title"] for card in res.get_json()["data"]["columns"][0]["cards"]] == ["Kept"]


def test_get_board_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    assert_error(client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user_3)), 404)


def test_get_unknown_board_returns_the_same_404(client, board, test_user_3, auth_headers):
    headers = auth_headers(test_user_3)

    unknown = assert_error(client.get(f"/api/boards/{uuid.uuid4()}", headers=headers), 404)
    not_member = assert_error(client.get(f"/api/boards/{board.id}", headers=headers), 404)

    assert unknown == not_member


def test_get_board_without_token_returns_401(client, board):
    assert_error(client.get(f"/api/boards/{board.id}"), 401)


# --- PATCH /api/boards/<id> ----------------------------------------------------


def test_rename_board_as_admin_returns_200(client, board, test_user, auth_headers):
    res = client.patch(
        f"/api/boards/{board.id}", json={"name": "  Renamed  "}, headers=auth_headers(test_user)
    )

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["id"] == str(board.id)
    assert data["name"] == "Renamed"
    assert db.session.get(Board, board.id).name == "Renamed"


def test_rename_board_as_member_returns_403(client, board, test_user_2, auth_headers):
    res = client.patch(
        f"/api/boards/{board.id}", json={"name": "Hijacked"}, headers=auth_headers(test_user_2)
    )

    assert_error(res, 403)
    assert db.session.get(Board, board.id).name == "Sprint Board"


def test_rename_board_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    res = client.patch(
        f"/api/boards/{board.id}", json={"name": "Hijacked"}, headers=auth_headers(test_user_3)
    )

    assert_error(res, 404)


def test_rename_board_without_name_returns_400(client, board, test_user, auth_headers):
    res = client.patch(f"/api/boards/{board.id}", json={}, headers=auth_headers(test_user))

    assert assert_error(res, 400).startswith("name:")


def test_rename_board_without_token_returns_401(client, board):
    assert_error(client.patch(f"/api/boards/{board.id}", json={"name": "x"}), 401)


# --- DELETE /api/boards/<id> ---------------------------------------------------


def test_delete_board_as_admin_removes_board_columns_cards_and_comments(
    client, board, test_user, test_user_2, auth_headers
):
    board_id = board.id
    column = add_column(board, "To Do", 1024)
    card = add_card(column, test_user, "Task", 1024)
    db.session.add(Comment(card_id=card.id, author_id=test_user.id, content="hello"))
    db.session.add(
        Notification(
            user_id=test_user_2.id, type="board_invite", message="x", board_id=board_id,
            card_id=card.id,
        )
    )
    db.session.commit()

    res = client.delete(f"/api/boards/{board_id}", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(board_id)}}
    db.session.expire_all()
    for model in (Board, BoardMember, BoardColumn, Card, Comment):
        assert db.session.query(model).count() == 0, model.__name__
    # The notification survives, with its links cleared (ON DELETE SET NULL).
    notification = db.session.query(Notification).one()
    assert notification.board_id is None
    assert notification.card_id is None


def test_delete_board_as_member_returns_403(client, board, test_user_2, auth_headers):
    res = client.delete(f"/api/boards/{board.id}", headers=auth_headers(test_user_2))

    assert_error(res, 403)
    assert db.session.get(Board, board.id) is not None


def test_delete_board_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    res = client.delete(f"/api/boards/{board.id}", headers=auth_headers(test_user_3))

    assert_error(res, 404)
    assert db.session.get(Board, board.id) is not None


def test_delete_board_without_token_returns_401(client, board):
    assert_error(client.delete(f"/api/boards/{board.id}"), 401)


# --- GET /api/boards/<id>/members ----------------------------------------------


def test_list_members_as_member_returns_200(client, board, test_user, test_user_2, auth_headers):
    res = client.get(f"/api/boards/{board.id}/members", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    assert res.get_json() == {
        "data": [
            {
                "user_id": str(test_user.id),
                "name": "Alice Admin",
                "email": "alice@example.com",
                "role": "admin",
            },
            {
                "user_id": str(test_user_2.id),
                "name": "Bob Member",
                "email": "bob@example.com",
                "role": "member",
            },
        ]
    }


def test_list_members_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    res = client.get(f"/api/boards/{board.id}/members", headers=auth_headers(test_user_3))

    assert_error(res, 404)


def test_list_members_without_token_returns_401(client, board):
    assert_error(client.get(f"/api/boards/{board.id}/members"), 401)


# --- POST /api/boards/<id>/members ---------------------------------------------


def test_add_member_as_admin_returns_201_and_notifies_the_new_member(
    client, board, test_user, test_user_3, auth_headers
):
    res = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": "CAROL@example.com", "role": "member"},
        headers=auth_headers(test_user),
    )

    assert res.status_code == 201
    assert res.get_json() == {
        "data": {
            "user_id": str(test_user_3.id),
            "name": "Carol Outsider",
            "email": "carol@example.com",
            "role": "member",
        }
    }
    notification = db.session.query(Notification).one()
    assert notification.user_id == test_user_3.id
    assert notification.type == "board_invite"
    assert notification.board_id == board.id
    assert notification.is_read is False
    assert "Sprint Board" in notification.message


def test_added_member_can_open_the_board(client, board, test_user, test_user_3, auth_headers):
    client.post(
        f"/api/boards/{board.id}/members",
        json={"email": test_user_3.email, "role": "member"},
        headers=auth_headers(test_user),
    )

    res = client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user_3))

    assert res.status_code == 200
    assert res.get_json()["data"]["role"] == "member"


def test_add_member_with_unregistered_email_returns_404(client, board, test_user, auth_headers):
    res = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": "ghost@example.com", "role": "member"},
        headers=auth_headers(test_user),
    )

    assert_error(res, 404)
    assert db.session.query(Notification).count() == 0


def test_add_existing_member_returns_409(client, board, test_user, test_user_2, auth_headers):
    res = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": test_user_2.email, "role": "admin"},
        headers=auth_headers(test_user),
    )

    assert_error(res, 409)
    assert db.session.query(BoardMember).filter_by(board_id=board.id).count() == 2
    assert db.session.query(Notification).count() == 0


@pytest.mark.parametrize(
    "body, field",
    [
        ({"email": "carol@example.com", "role": "owner"}, "role"),
        ({"email": "carol@example.com"}, "role"),
        ({"role": "member"}, "email"),
        ({"email": "not-an-email", "role": "member"}, "email"),
    ],
)
def test_add_member_with_invalid_body_returns_400(
    client, board, test_user, test_user_3, auth_headers, body, field
):
    res = client.post(
        f"/api/boards/{board.id}/members", json=body, headers=auth_headers(test_user)
    )

    assert assert_error(res, 400).startswith(f"{field}:")
    assert db.session.query(BoardMember).filter_by(board_id=board.id).count() == 2


def test_add_member_as_member_returns_403(client, board, test_user_2, test_user_3, auth_headers):
    res = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": test_user_3.email, "role": "member"},
        headers=auth_headers(test_user_2),
    )

    assert_error(res, 403)
    assert db.session.query(BoardMember).filter_by(board_id=board.id).count() == 2


def test_add_member_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    res = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": test_user_3.email, "role": "admin"},
        headers=auth_headers(test_user_3),
    )

    assert_error(res, 404)


def test_add_member_without_token_returns_401(client, board):
    res = client.post(
        f"/api/boards/{board.id}/members", json={"email": "carol@example.com", "role": "member"}
    )

    assert_error(res, 401)


# --- PATCH /api/boards/<id>/members/<user_id> ----------------------------------


def test_promote_member_returns_200(client, board, test_user, test_user_2, auth_headers):
    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user_2.id}",
        json={"role": "admin"},
        headers=auth_headers(test_user),
    )

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["user_id"] == str(test_user_2.id)
    assert data["role"] == "admin"


def test_demote_last_admin_returns_400(client, board, test_user, auth_headers):
    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user.id}",
        json={"role": "member"},
        headers=auth_headers(test_user),
    )

    assert_error(res, 400)
    membership = db.session.query(BoardMember).filter_by(user_id=test_user.id).one()
    assert membership.role == "admin"


def test_demote_admin_is_allowed_when_another_admin_exists(
    client, test_user, test_user_2, auth_headers
):
    board = make_board(test_user, members=[(test_user_2, "admin")])

    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user.id}",
        json={"role": "member"},
        headers=auth_headers(test_user),
    )

    assert res.status_code == 200
    assert res.get_json()["data"]["role"] == "member"


def test_update_role_with_invalid_role_returns_400(
    client, board, test_user, test_user_2, auth_headers
):
    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user_2.id}",
        json={"role": "owner"},
        headers=auth_headers(test_user),
    )

    assert assert_error(res, 400).startswith("role:")


def test_update_role_as_member_returns_403(client, board, test_user_2, auth_headers):
    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user_2.id}",
        json={"role": "admin"},
        headers=auth_headers(test_user_2),
    )

    assert_error(res, 403)
    membership = db.session.query(BoardMember).filter_by(user_id=test_user_2.id).one()
    assert membership.role == "member"


def test_update_role_of_user_not_on_board_returns_404(
    client, board, test_user, test_user_3, auth_headers
):
    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user_3.id}",
        json={"role": "admin"},
        headers=auth_headers(test_user),
    )

    assert_error(res, 404)


def test_update_role_without_token_returns_401(client, board, test_user_2):
    res = client.patch(
        f"/api/boards/{board.id}/members/{test_user_2.id}", json={"role": "admin"}
    )

    assert_error(res, 401)


# --- DELETE /api/boards/<id>/members/<user_id> ---------------------------------


def test_remove_member_returns_200_and_revokes_access(
    client, board, test_user, test_user_2, auth_headers
):
    res = client.delete(
        f"/api/boards/{board.id}/members/{test_user_2.id}", headers=auth_headers(test_user)
    )

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(test_user_2.id)}}
    after = client.get(f"/api/boards/{board.id}", headers=auth_headers(test_user_2))
    assert_error(after, 404)


def test_remove_last_admin_returns_400(client, board, test_user, auth_headers):
    res = client.delete(
        f"/api/boards/{board.id}/members/{test_user.id}", headers=auth_headers(test_user)
    )

    assert_error(res, 400)
    assert db.session.query(BoardMember).filter_by(board_id=board.id).count() == 2


def test_remove_member_as_member_returns_403(client, board, test_user, test_user_2, auth_headers):
    res = client.delete(
        f"/api/boards/{board.id}/members/{test_user.id}", headers=auth_headers(test_user_2)
    )

    assert_error(res, 403)
    assert db.session.query(BoardMember).filter_by(board_id=board.id).count() == 2


def test_remove_user_not_on_board_returns_404(client, board, test_user, test_user_3, auth_headers):
    res = client.delete(
        f"/api/boards/{board.id}/members/{test_user_3.id}", headers=auth_headers(test_user)
    )

    assert_error(res, 404)


def test_remove_member_without_token_returns_401(client, board, test_user_2):
    assert_error(client.delete(f"/api/boards/{board.id}/members/{test_user_2.id}"), 401)
