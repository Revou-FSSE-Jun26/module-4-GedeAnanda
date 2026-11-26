"""Notification list, mark-as-read and the "never notify the actor" rule (REQ-11)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import Notification
from tests.helpers import add_card, add_column, add_notification, assert_error

URL = "/api/notifications"


def add_many(user, count):
    """``count`` notifications, "N1" oldest to "N<count>" newest."""
    start = datetime.now(timezone.utc) - timedelta(minutes=count)
    return [
        add_notification(user, f"N{index}", created_at=start + timedelta(minutes=index))
        for index in range(1, count + 1)
    ]


# --- GET /api/notifications ----------------------------------------------------


def test_list_returns_my_notifications_newest_first_with_unread_count(
    client, test_user, test_user_2, auth_headers
):
    now = datetime.now(timezone.utc)
    add_notification(test_user, "Oldest", created_at=now - timedelta(hours=2), is_read=True)
    newest = add_notification(test_user, "Newest", created_at=now)
    add_notification(test_user, "Middle", created_at=now - timedelta(hours=1))
    add_notification(test_user_2, "Not mine")

    res = client.get(URL, headers=auth_headers(test_user))

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert set(data) == {"items", "page", "per_page", "total", "unread_count"}
    assert [item["message"] for item in data["items"]] == ["Newest", "Middle", "Oldest"]
    assert (data["page"], data["per_page"], data["total"], data["unread_count"]) == (1, 20, 3, 2)
    assert data["items"][0] == {
        "id": str(newest.id),
        "type": "board_invite",
        "message": "Newest",
        "is_read": False,
        "card_id": None,
        "board_id": None,
        "created_at": data["items"][0]["created_at"],
    }


def test_list_is_empty_for_a_user_without_notifications(client, test_user, auth_headers):
    res = client.get(URL, headers=auth_headers(test_user))

    assert res.get_json() == {
        "data": {"items": [], "page": 1, "per_page": 20, "total": 0, "unread_count": 0}
    }


def test_list_defaults_to_20_per_page(client, test_user, auth_headers):
    add_many(test_user, 25)

    data = client.get(URL, headers=auth_headers(test_user)).get_json()["data"]

    assert len(data["items"]) == 20
    assert data["items"][0]["message"] == "N25"
    assert (data["total"], data["unread_count"]) == (25, 25)


def test_list_reads_page_and_per_page(client, test_user, auth_headers):
    add_many(test_user, 7)

    data = client.get(f"{URL}?page=2&per_page=3", headers=auth_headers(test_user)).get_json()["data"]

    assert [item["message"] for item in data["items"]] == ["N4", "N3", "N2"]
    assert (data["page"], data["per_page"], data["total"]) == (2, 3, 7)


def test_list_page_past_the_end_is_empty_but_keeps_the_totals(client, test_user, auth_headers):
    add_many(test_user, 3)

    data = client.get(f"{URL}?page=9", headers=auth_headers(test_user)).get_json()["data"]

    assert data["items"] == []
    assert (data["total"], data["unread_count"]) == (3, 3)


def test_list_accepts_the_maximum_per_page(client, test_user, auth_headers):
    add_many(test_user, 2)

    res = client.get(f"{URL}?per_page=100", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json()["data"]["per_page"] == 100


@pytest.mark.parametrize(
    "query, field",
    [
        ("page=0", "page"),
        ("page=-1", "page"),
        ("page=abc", "page"),
        ("page=1.5", "page"),
        ("per_page=0", "per_page"),
        ("per_page=101", "per_page"),
        ("per_page=many", "per_page"),
    ],
)
def test_list_with_invalid_pagination_returns_400(client, test_user, auth_headers, query, field):
    res = client.get(f"{URL}?{query}", headers=auth_headers(test_user))

    assert assert_error(res, 400).startswith(f"{field}:")


def test_list_without_token_returns_401(client):
    assert_error(client.get(URL), 401)


# --- PATCH /api/notifications/<id>/read ----------------------------------------


def test_mark_as_read_returns_200_and_lowers_the_unread_count(client, test_user, auth_headers):
    first, _ = add_many(test_user, 2)
    headers = auth_headers(test_user)

    res = client.patch(f"{URL}/{first.id}/read", headers=headers)

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["id"] == str(first.id)
    assert data["is_read"] is True
    assert client.get(URL, headers=headers).get_json()["data"]["unread_count"] == 1


def test_mark_as_read_twice_is_harmless(client, test_user, auth_headers):
    notification = add_notification(test_user)
    headers = auth_headers(test_user)

    client.patch(f"{URL}/{notification.id}/read", headers=headers)
    res = client.patch(f"{URL}/{notification.id}/read", headers=headers)

    assert res.status_code == 200
    assert res.get_json()["data"]["is_read"] is True


def test_mark_someone_elses_notification_returns_same_404_as_unknown(
    client, test_user, test_user_2, auth_headers
):
    theirs = add_notification(test_user_2)
    headers = auth_headers(test_user)

    other = client.patch(f"{URL}/{theirs.id}/read", headers=headers)
    unknown = client.patch(f"{URL}/{uuid.uuid4()}/read", headers=headers)

    assert assert_error(other, 404) == assert_error(unknown, 404)
    db.session.expire_all()
    assert theirs.is_read is False


def test_mark_as_read_without_token_returns_401(client, test_user):
    notification = add_notification(test_user)

    assert_error(client.patch(f"{URL}/{notification.id}/read"), 401)
    db.session.expire_all()
    assert notification.is_read is False


# --- Property 5: the actor is never a recipient (REQ-11.1 to 11.3) --------------


@pytest.mark.parametrize("event", ["card_assigned", "comment_added", "board_invite"])
def test_property_5_the_actor_is_never_notified(
    client, board, test_user, test_user_2, test_user_3, auth_headers, event
):
    """Alice (admin) acts; Bob is the other person involved. Alice must get nothing."""
    headers = auth_headers(test_user)
    column = add_column(board, "To Do", 1024)

    if event == "card_assigned":
        res = client.post(
            f"/api/columns/{column.id}/cards",
            json={"title": "Task", "assignee_id": str(test_user_2.id)},
            headers=headers,
        )
        expected = {test_user_2.id}
    elif event == "comment_added":
        # Alice created the card and comments on it herself; Bob is assigned.
        card = add_card(column, test_user, "Task", 1024, assignee=test_user_2)
        res = client.post(f"/api/cards/{card.id}/comments", json={"content": "Hi"}, headers=headers)
        expected = {test_user_2.id}
    else:
        res = client.post(
            f"/api/boards/{board.id}/members",
            json={"email": test_user_3.email, "role": "member"},
            headers=headers,
        )
        expected = {test_user_3.id}

    assert res.status_code == 201
    notifications = db.session.query(Notification).all()
    assert {n.type for n in notifications} == {event}
    assert {n.user_id for n in notifications} == expected
    assert test_user.id not in {n.user_id for n in notifications}
    # The actor's own list stays empty; the recipient sees it through the API.
    assert client.get(URL, headers=headers).get_json()["data"]["total"] == 0
