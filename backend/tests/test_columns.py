"""Column CRUD and the FLOAT order strategy (REQ-6)."""

import uuid
from datetime import datetime, timezone

import pytest

from app.extensions import db
from app.models import BoardColumn, Card, Comment
from tests.conftest import make_board
from tests.helpers import add_card, add_column, assert_error


def column_names(board_id):
    """Column names of a board as stored, sorted by ``order``."""
    db.session.expire_all()
    rows = db.session.query(BoardColumn).filter_by(board_id=board_id).order_by(BoardColumn.order)
    return [column.name for column in rows]


def reorder(client, headers, board, column, order):
    return client.patch(
        f"/api/boards/{board.id}/columns/reorder",
        json={"column_id": str(column.id), "order": order},
        headers=headers,
    )


# --- POST /api/boards/<id>/columns ---------------------------------------------


def test_first_column_gets_order_1024(client, board, test_user_2, auth_headers):
    res = client.post(
        f"/api/boards/{board.id}/columns", json={"name": "  To Do "}, headers=auth_headers(test_user_2)
    )

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert set(data) == {"id", "board_id", "name", "order", "is_done"}
    assert data["board_id"] == str(board.id)
    assert data["name"] == "To Do"
    assert data["order"] == 1024
    assert data["is_done"] is False


def test_next_column_gets_last_order_plus_1024(client, board, test_user, auth_headers):
    add_column(board, "To Do", 1024)
    add_column(board, "Doing", 5000)

    res = client.post(
        f"/api/boards/{board.id}/columns",
        json={"name": "Done", "is_done": True},
        headers=auth_headers(test_user),
    )

    assert res.status_code == 201
    assert res.get_json()["data"]["order"] == 6024
    assert res.get_json()["data"]["is_done"] is True


def test_column_order_is_counted_per_board(client, board, test_user, auth_headers):
    add_column(make_board(test_user, name="Other"), "Elsewhere", 9000)

    res = client.post(
        f"/api/boards/{board.id}/columns", json={"name": "To Do"}, headers=auth_headers(test_user)
    )

    assert res.get_json()["data"]["order"] == 1024


@pytest.mark.parametrize(
    "body, field",
    [({}, "name"), ({"name": "  "}, "name"), ({"name": "x" * 101}, "name"),
     ({"name": "ok", "is_done": "maybe"}, "is_done")],
)
def test_create_column_with_invalid_body_returns_400(
    client, board, test_user, auth_headers, body, field
):
    res = client.post(f"/api/boards/{board.id}/columns", json=body, headers=auth_headers(test_user))

    assert assert_error(res, 400).startswith(f"{field}:")
    assert db.session.query(BoardColumn).count() == 0


def test_create_column_without_token_returns_401(client, board):
    assert_error(client.post(f"/api/boards/{board.id}/columns", json={"name": "To Do"}), 401)


def test_create_column_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    res = client.post(
        f"/api/boards/{board.id}/columns", json={"name": "To Do"}, headers=auth_headers(test_user_3)
    )

    assert_error(res, 404)
    assert db.session.query(BoardColumn).count() == 0


# --- PATCH /api/columns/<id> ---------------------------------------------------


def test_update_column_renames_and_toggles_is_done(client, board, test_user_2, auth_headers):
    column = add_column(board, "Doing", 1024)

    res = client.patch(
        f"/api/columns/{column.id}",
        json={"name": "Done", "is_done": True},
        headers=auth_headers(test_user_2),
    )

    assert res.status_code == 200
    assert res.get_json()["data"] == {
        "id": str(column.id),
        "board_id": str(board.id),
        "name": "Done",
        "order": 1024,
        "is_done": True,
    }


def test_update_column_changes_only_the_fields_sent(client, board, test_user, auth_headers):
    column = add_column(board, "Done", 1024, is_done=True)

    res = client.patch(
        f"/api/columns/{column.id}", json={"name": "Shipped"}, headers=auth_headers(test_user)
    )

    assert res.status_code == 200
    assert res.get_json()["data"]["name"] == "Shipped"
    assert res.get_json()["data"]["is_done"] is True


@pytest.mark.parametrize("body", [{}, {"name": ""}, {"is_done": None}, {"order": 5}])
def test_update_column_without_valid_fields_returns_400(
    client, board, test_user, auth_headers, body
):
    column = add_column(board, "Doing", 1024)

    res = client.patch(f"/api/columns/{column.id}", json=body, headers=auth_headers(test_user))

    assert_error(res, 400)
    db.session.expire_all()
    assert (column.name, column.order, column.is_done) == ("Doing", 1024, False)


def test_update_column_without_token_returns_401(client, board):
    column = add_column(board, "Doing", 1024)

    assert_error(client.patch(f"/api/columns/{column.id}", json={"name": "x"}), 401)


def test_update_column_as_non_member_returns_same_404_as_unknown_column(
    client, board, test_user_3, auth_headers
):
    column = add_column(board, "Doing", 1024)
    headers = auth_headers(test_user_3)

    not_member = client.patch(f"/api/columns/{column.id}", json={"name": "x"}, headers=headers)
    unknown = client.patch(f"/api/columns/{uuid.uuid4()}", json={"name": "x"}, headers=headers)

    assert assert_error(not_member, 404) == assert_error(unknown, 404)
    db.session.expire_all()
    assert column.name == "Doing"


# --- DELETE /api/columns/<id> --------------------------------------------------


def test_delete_column_as_admin_removes_column_cards_and_comments(
    client, board, test_user, auth_headers
):
    keep = add_column(board, "To Do", 1024)
    kept_card = add_card(keep, test_user, "Stays", 1024)
    column = add_column(board, "Doing", 2048)
    card = add_card(column, test_user, "Goes", 1024)
    add_card(column, test_user, "Soft-deleted, goes too", 2048, deleted=True)
    db.session.add(Comment(card_id=card.id, author_id=test_user.id, content="hello"))
    db.session.commit()
    column_id, kept_card_id = column.id, kept_card.id

    res = client.delete(f"/api/columns/{column_id}", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(column_id)}}
    db.session.expire_all()
    assert column_names(board.id) == ["To Do"]
    assert [c.id for c in db.session.query(Card)] == [kept_card_id]
    assert db.session.query(Comment).count() == 0


def test_delete_column_as_member_returns_403(client, board, test_user_2, auth_headers):
    column = add_column(board, "Doing", 1024)

    res = client.delete(f"/api/columns/{column.id}", headers=auth_headers(test_user_2))

    assert_error(res, 403)
    assert db.session.query(BoardColumn).count() == 1


def test_delete_column_as_non_member_returns_404(client, board, test_user_3, auth_headers):
    column = add_column(board, "Doing", 1024)

    res = client.delete(f"/api/columns/{column.id}", headers=auth_headers(test_user_3))

    assert_error(res, 404)
    assert db.session.query(BoardColumn).count() == 1


def test_delete_unknown_column_returns_404(client, test_user, auth_headers):
    assert_error(client.delete(f"/api/columns/{uuid.uuid4()}", headers=auth_headers(test_user)), 404)


def test_delete_column_without_token_returns_401(client, board):
    column = add_column(board, "Doing", 1024)

    assert_error(client.delete(f"/api/columns/{column.id}"), 401)


# --- PATCH /api/boards/<id>/columns/reorder ------------------------------------


@pytest.fixture
def four_columns(board):
    """A(1024) B(2048) C(3072) D(4096)."""
    return [add_column(board, name, (i + 1) * 1024) for i, name in enumerate("ABCD")]


def test_reorder_updates_one_column_and_reports_no_rebalance(
    client, board, test_user_2, auth_headers, four_columns
):
    res = reorder(client, auth_headers(test_user_2), board, four_columns[3], 1536)

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["column"]["id"] == str(four_columns[3].id)
    assert data["column"]["order"] == 1536
    assert data["rebalanced"] is False
    assert data["column_orders"] == []
    db.session.expire_all()
    assert [c.order for c in four_columns] == [1024, 2048, 3072, 1536]


@pytest.mark.parametrize(
    "target, expected",
    [
        ("top", ["D", "A", "B", "C"]),
        ("between A and B", ["A", "D", "B", "C"]),
        ("between B and C", ["A", "B", "D", "C"]),
        ("end", ["A", "B", "C", "D"]),
    ],
)
def test_property_1_insert_lands_at_the_intended_position(
    client, board, test_user, auth_headers, four_columns, target, expected
):
    """Property 1: an order computed with the documented strategy sorts where intended."""
    a, b, c, d = four_columns
    order = {
        "top": a.order / 2,
        "between A and B": (a.order + b.order) / 2,
        "between B and C": (b.order + c.order) / 2,
        "end": c.order + 1024,
    }[target]

    res = reorder(client, auth_headers(test_user), board, d, order)

    assert res.status_code == 200
    assert column_names(board.id) == expected


def test_property_1_repeated_top_inserts_keep_the_intended_order(
    client, board, test_user, auth_headers, four_columns
):
    """Insert at the top 40 times in a row; each moved column must become the first."""
    headers = auth_headers(test_user)
    columns = {column.name: column for column in four_columns}
    expected = ["A", "B", "C", "D"]

    for step in range(40):
        name = expected[-1]
        db.session.expire_all()
        first_order = columns[expected[0]].order
        res = reorder(client, headers, board, columns[name], first_order / 2)
        assert res.status_code == 200
        expected = [name] + expected[:-1]
        assert column_names(board.id) == expected, f"step {step}"


@pytest.mark.parametrize(
    "orders, moved, new_order, expected",
    [
        # Dropped between two columns that are already almost touching.
        ([1024, 1024.0000008, 3072, 4096], "D", 1024.0000004, ["A", "D", "B", "C"]),
        # Dropped at the top with an order nearly zero; its neighbour is far enough away.
        ([0.000003, 2048, 3072, 4096], "D", 0.0000005, ["D", "A", "B", "C"]),
        # Dropped just below a column, closer than the minimum gap.
        ([1024, 2048, 3072, 4096], "A", 3072.0000001, ["B", "C", "A", "D"]),
    ],
)
def test_property_2_rebalance_keeps_relative_order(
    client, board, test_user, auth_headers, orders, moved, new_order, expected
):
    """Property 2: after a forced rebalance the columns are 1024, 2048, ... in the same order."""
    columns = {name: add_column(board, name, order) for name, order in zip("ABCD", orders)}

    res = reorder(client, auth_headers(test_user), board, columns[moved], new_order)

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["rebalanced"] is True
    assert data["column_orders"] == [
        {"id": str(columns[name].id), "order": (index + 1) * 1024}
        for index, name in enumerate(expected)
    ]
    assert data["column"]["order"] == (expected.index(moved) + 1) * 1024
    assert column_names(board.id) == expected
    db.session.expire_all()
    assert sorted(column.order for column in columns.values()) == [1024, 2048, 3072, 4096]


def test_rebalance_does_not_touch_other_boards(client, board, test_user, auth_headers):
    other = add_column(make_board(test_user, name="Other"), "Elsewhere", 1024.0000005)
    a = add_column(board, "A", 1024)
    add_column(board, "B", 2048)

    res = reorder(client, auth_headers(test_user), board, a, 2048.0000001)

    assert res.get_json()["data"]["rebalanced"] is True
    db.session.expire_all()
    assert other.order == 1024.0000005


def test_reorder_with_column_from_another_board_returns_400(
    client, board, test_user, auth_headers, four_columns
):
    foreign = add_column(make_board(test_user, name="Other"), "Elsewhere", 1024)

    res = reorder(client, auth_headers(test_user), board, foreign, 512)

    assert assert_error(res, 400).startswith("column_id:")
    db.session.expire_all()
    assert foreign.order == 1024


@pytest.mark.parametrize(
    "body, field",
    [
        ({"column_id": str(uuid.uuid4()), "order": 512}, "column_id"),
        ({"column_id": "not-a-uuid", "order": 512}, "column_id"),
        ({"order": 512}, "column_id"),
        ({"column_id": "COLUMN", "order": 0}, "order"),
        ({"column_id": "COLUMN", "order": -5}, "order"),
        ({"column_id": "COLUMN", "order": "first"}, "order"),
        ({"column_id": "COLUMN"}, "order"),
    ],
)
def test_reorder_with_invalid_body_returns_400(
    client, board, test_user, auth_headers, four_columns, body, field
):
    if body.get("column_id") == "COLUMN":
        body = {**body, "column_id": str(four_columns[0].id)}

    res = client.patch(
        f"/api/boards/{board.id}/columns/reorder", json=body, headers=auth_headers(test_user)
    )

    assert assert_error(res, 400).startswith(f"{field}:")
    db.session.expire_all()
    assert [c.order for c in four_columns] == [1024, 2048, 3072, 4096]


def test_reorder_as_non_member_returns_404(client, board, test_user_3, auth_headers, four_columns):
    res = reorder(client, auth_headers(test_user_3), board, four_columns[0], 5000)

    assert_error(res, 404)
    db.session.expire_all()
    assert four_columns[0].order == 1024


def test_reorder_without_token_returns_401(client, board, four_columns):
    res = client.patch(
        f"/api/boards/{board.id}/columns/reorder",
        json={"column_id": str(four_columns[0].id), "order": 5000},
    )

    assert_error(res, 401)


# --- is_done changes and the cards' completed_at (REQ-39.6 to REQ-39.8) -------------------


def patch_column(client, headers, column, **body):
    return client.patch(f"/api/columns/{column.id}", json=body, headers=headers)


def test_marking_a_column_done_finishes_its_open_cards(client, board, test_user, auth_headers):
    column = add_column(board, "Shipped", 1024)
    first = add_card(column, test_user, "First", 1024)
    second = add_card(column, test_user, "Second", 2048)

    res = patch_column(client, auth_headers(test_user), column, is_done=True)

    assert res.status_code == 200
    db.session.expire_all()
    assert first.completed_at is not None
    assert second.completed_at == first.completed_at


def test_marking_a_column_done_keeps_the_time_a_card_was_already_finished_at(
    client, board, test_user, auth_headers
):
    column = add_column(board, "Shipped", 1024)
    card = add_card(column, test_user, "Finished last week", 1024)
    earlier = datetime(2026, 11, 20, 9, 0, tzinfo=timezone.utc)
    card.completed_at = earlier
    db.session.commit()

    patch_column(client, auth_headers(test_user), column, is_done=True)

    db.session.expire_all()
    assert card.completed_at == earlier


def test_unmarking_a_done_column_reopens_its_cards(client, board, test_user, auth_headers):
    column = add_column(board, "Done", 1024, is_done=True)
    card = add_card(column, test_user, "Finished", 1024)
    card.completed_at = datetime.now(timezone.utc)
    db.session.commit()

    res = patch_column(client, auth_headers(test_user), column, is_done=False)

    assert res.status_code == 200
    db.session.expire_all()
    assert card.completed_at is None


def test_changing_is_done_touches_only_that_columns_active_cards(
    client, board, test_user, auth_headers
):
    target = add_column(board, "Shipped", 1024)
    other = add_column(board, "To Do", 2048)
    elsewhere = add_card(other, test_user, "In another column", 1024)
    deleted = add_card(target, test_user, "Deleted", 1024, deleted=True)

    patch_column(client, auth_headers(test_user), target, is_done=True)

    db.session.expire_all()
    assert elsewhere.completed_at is None
    assert deleted.completed_at is None


def test_renaming_a_column_leaves_completed_at_alone(client, board, test_user, auth_headers):
    column = add_column(board, "Done", 1024, is_done=True)
    card = add_card(column, test_user, "Open card in a done column", 1024)  # completed_at is null

    patch_column(client, auth_headers(test_user), column, name="Finished")

    db.session.expire_all()
    assert card.completed_at is None


def test_sending_the_same_is_done_again_changes_no_card(client, board, test_user, auth_headers):
    column = add_column(board, "Done", 1024, is_done=True)
    card = add_card(column, test_user, "Open card in a done column", 1024)

    patch_column(client, auth_headers(test_user), column, is_done=True)

    db.session.expire_all()
    assert card.completed_at is None


def test_a_card_finished_by_its_column_shows_as_finished_in_my_tasks(
    client, board, test_user, auth_headers
):
    column = add_column(board, "Shipped", 1024)
    add_card(column, test_user, "Mine", 1024, assignee=test_user)
    headers = auth_headers(test_user)

    patch_column(client, headers, column, is_done=True)

    mine = client.get("/api/cards?assignee=me", headers=headers).get_json()["data"]
    assert mine[0]["completed_at"] is not None
