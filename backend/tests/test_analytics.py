"""Board analytics for admins (REQ-15)."""

import uuid
from datetime import datetime, timedelta, timezone

from app.blueprints.analytics.service import start_of_iso_week
from app.extensions import db
from app.models import Board, User
from tests.conftest import make_board
from tests.helpers import add_card, add_column, add_comment, assert_error


def url(board):
    return f"/api/boards/{board.id}/analytics"


def complete(card, moment):
    card.completed_at = moment
    db.session.commit()


def test_start_of_iso_week_is_monday_midnight():
    # 2026-11-27 is a Friday; 2026-11-23 is that week's Monday.
    friday = datetime(2026, 11, 27, 15, 30, 45, 123, tzinfo=timezone.utc)
    monday = datetime(2026, 11, 23, tzinfo=timezone.utc)
    sunday_night = datetime(2026, 11, 29, 23, 59, 59, tzinfo=timezone.utc)

    assert start_of_iso_week(friday) == monday
    assert start_of_iso_week(monday) == monday
    assert start_of_iso_week(sunday_night) == monday


def test_analytics_as_admin_returns_all_three_metrics(
    client, board, test_user, test_user_2, auth_headers
):
    now = datetime.now(timezone.utc)
    week_start = start_of_iso_week(now)
    todo = add_column(board, "To Do", 1024)
    done = add_column(board, "Done", 2048, is_done=True)
    empty = add_column(board, "Empty", 3072)

    # To Do: two active cards and one deleted.
    task_a = add_card(todo, test_user, "A", 1024, assignee=test_user_2)
    add_card(todo, test_user_2, "B", 2048, assignee=test_user_2)
    gone = add_card(todo, test_user_2, "Deleted", 3072, assignee=test_user_2, deleted=True)
    # Done: finished at the first instant of this week, last week, and (deleted) this week.
    complete(add_card(done, test_user, "This week", 1024), week_start)
    complete(add_card(done, test_user, "Last week", 2048), week_start - timedelta(seconds=1))
    complete(add_card(done, test_user, "Deleted done", 3072, deleted=True), week_start)

    add_comment(task_a, test_user_2, "recent", created_at=now - timedelta(days=6, hours=23))
    add_comment(task_a, test_user_2, "today", created_at=now)
    add_comment(task_a, test_user_2, "too old", created_at=now - timedelta(days=7, hours=1))
    add_comment(task_a, test_user, "from alice", created_at=now - timedelta(days=1))
    add_comment(gone, test_user_2, "on a deleted card", created_at=now)

    res = client.get(url(board), headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json() == {
        "data": {
            "cards_per_column": [
                {"column_id": str(todo.id), "column_name": "To Do", "count": 2},
                {"column_id": str(done.id), "column_name": "Done", "count": 2},
                {"column_id": str(empty.id), "column_name": "Empty", "count": 0},
            ],
            "completed_this_week": 1,
            "member_activity": [
                {
                    "user_id": str(test_user.id),
                    "name": "Alice Admin",
                    "cards_created": 3,
                    "cards_assigned": 0,
                    "comments_last_7_days": 1,
                },
                {
                    "user_id": str(test_user_2.id),
                    "name": "Bob Member",
                    "cards_created": 1,
                    "cards_assigned": 2,
                    "comments_last_7_days": 2,
                },
            ],
        }
    }


def test_analytics_of_an_empty_board(client, board, test_user, test_user_2, auth_headers):
    res = client.get(url(board), headers=auth_headers(test_user))

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["cards_per_column"] == []
    assert data["completed_this_week"] == 0
    assert [(m["name"], m["cards_created"], m["cards_assigned"], m["comments_last_7_days"])
            for m in data["member_activity"]] == [("Alice Admin", 0, 0, 0), ("Bob Member", 0, 0, 0)]


def test_analytics_counts_only_this_board(client, board, test_user, test_user_2, auth_headers):
    now = datetime.now(timezone.utc)
    add_column(board, "To Do", 1024)
    other = make_board(test_user, name="Other", members=[(test_user_2, "member")])
    other_done = add_column(other, "Done", 1024, is_done=True)
    card = add_card(other_done, test_user, "Elsewhere", 1024, assignee=test_user_2)
    complete(card, now)
    add_comment(card, test_user_2, "elsewhere", created_at=now)

    data = client.get(url(board), headers=auth_headers(test_user)).get_json()["data"]

    assert [column["count"] for column in data["cards_per_column"]] == [0]
    assert data["completed_this_week"] == 0
    assert all(
        (m["cards_created"], m["cards_assigned"], m["comments_last_7_days"]) == (0, 0, 0)
        for m in data["member_activity"]
    )


def test_analytics_uses_a_fixed_number_of_queries(
    client, board, test_user, test_user_2, auth_headers, count_queries
):
    headers = auth_headers(test_user)
    target = url(board)
    board_id, user_ids = board.id, [test_user.id, test_user_2.id]

    def add_columns(first, last):
        users = [db.session.get(User, user_id) for user_id in user_ids]
        for index in range(first, last + 1):
            column = add_column(db.session.get(Board, board_id), f"Column {index}", index * 1024)
            for position in range(1, 4):
                card = add_card(column, users[position % 2], f"Card {position}", position * 1024,
                                assignee=users[(position + 1) % 2])
                add_comment(card, users[position % 2], "note")
        db.session.expunge_all()

    add_columns(1, 1)
    _, small = count_queries(lambda: client.get(target, headers=headers))
    add_columns(2, 6)
    res, large = count_queries(lambda: client.get(target, headers=headers))

    assert sum(column["count"] for column in res.get_json()["data"]["cards_per_column"]) == 18
    assert large == small
    assert large <= 7


def test_analytics_as_member_returns_403(client, board, test_user_2, auth_headers):
    assert_error(client.get(url(board), headers=auth_headers(test_user_2)), 403)


def test_analytics_as_non_member_returns_same_404_as_unknown_board(
    client, board, test_user_3, auth_headers
):
    headers = auth_headers(test_user_3)

    not_member = client.get(url(board), headers=headers)
    unknown = client.get(f"/api/boards/{uuid.uuid4()}/analytics", headers=headers)

    assert assert_error(not_member, 404) == assert_error(unknown, 404)


def test_analytics_without_token_returns_401(client, board):
    assert_error(client.get(url(board)), 401)
