"""Comments on cards (REQ-10) and notification N2 (REQ-11.2)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.extensions import db
from app.models import BoardMember, Card, Comment, Notification, User
from tests.helpers import add_card, add_column, add_comment, assert_error


@pytest.fixture
def card(board, test_user):
    """A card created by Alice (admin) on the board. Bob is a member, Carol is not."""
    return add_card(add_column(board, "To Do", 1024), test_user, "Write docs", 1024)


@pytest.fixture
def comment(card, test_user_2):
    """A comment written by Bob."""
    return add_comment(card, test_user_2, "Original text")


def post(client, headers, card_id, **body):
    return client.post(f"/api/cards/{card_id}/comments", json=body, headers=headers)


def soft_delete(card):
    card.deleted_at = datetime.now(timezone.utc)
    db.session.commit()


# --- POST /api/cards/<id>/comments ---------------------------------------------


def test_create_comment_returns_201_with_nested_author(client, card, test_user_2, auth_headers):
    res = post(client, auth_headers(test_user_2), card.id, content="  Looks good  ")

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert set(data) == {"id", "card_id", "content", "created_at", "updated_at", "author"}
    assert data["card_id"] == str(card.id)
    assert data["content"] == "Looks good"
    assert data["author"] == {"id": str(test_user_2.id), "name": "Bob Member"}
    stored = db.session.query(Comment).one()
    assert stored.author_id == test_user_2.id


def test_create_comment_ignores_an_author_sent_by_the_client(
    client, card, test_user, test_user_2, auth_headers
):
    res = post(
        client, auth_headers(test_user_2), card.id, content="hi", author_id=str(test_user.id)
    )

    assert_error(res, 400)
    assert db.session.query(Comment).count() == 0


@pytest.mark.parametrize("body", [{}, {"content": ""}, {"content": "   "}, {"content": None}])
def test_create_comment_without_content_returns_400(client, card, test_user, auth_headers, body):
    res = post(client, auth_headers(test_user), card.id, **body)

    assert assert_error(res, 400).startswith("content:")
    assert db.session.query(Comment).count() == 0


def test_create_comment_longer_than_2000_returns_400(client, card, test_user, auth_headers):
    res = post(client, auth_headers(test_user), card.id, content="x" * 2001)

    assert assert_error(res, 400).startswith("content:")
    assert db.session.query(Comment).count() == 0


def test_create_comment_of_exactly_2000_characters_is_accepted(
    client, card, test_user, auth_headers
):
    res = post(client, auth_headers(test_user), card.id, content="x" * 2000)

    assert res.status_code == 201
    assert len(res.get_json()["data"]["content"]) == 2000


def test_create_comment_without_token_returns_401(client, card):
    res = client.post(f"/api/cards/{card.id}/comments", json={"content": "hi"})

    assert_error(res, 401)
    assert db.session.query(Comment).count() == 0


def test_create_comment_as_non_member_returns_404(client, card, test_user_3, auth_headers):
    res = post(client, auth_headers(test_user_3), card.id, content="let me in")

    assert_error(res, 404)
    assert db.session.query(Comment).count() == 0
    assert db.session.query(Notification).count() == 0


def test_create_comment_on_deleted_card_returns_same_404_as_unknown_card(
    client, card, test_user, auth_headers
):
    soft_delete(card)
    headers = auth_headers(test_user)

    deleted = post(client, headers, card.id, content="too late")
    unknown = post(client, headers, uuid.uuid4(), content="nowhere")

    assert assert_error(deleted, 404) == assert_error(unknown, 404)
    assert db.session.query(Comment).count() == 0


# --- Notification N2 -----------------------------------------------------------


def test_comment_notifies_creator_and_assignee_but_not_the_commenter(
    client, board, card, test_user, test_user_2, test_user_3, auth_headers
):
    """Alice created the card, Carol is assigned, Bob comments."""
    db.session.add(BoardMember(board_id=board.id, user_id=test_user_3.id, role="member"))
    card.assignee_id = test_user_3.id
    db.session.commit()

    post(client, auth_headers(test_user_2), card.id, content="Ping")

    notifications = db.session.query(Notification).all()
    assert {n.user_id for n in notifications} == {test_user.id, test_user_3.id}
    assert len(notifications) == 2
    for notification in notifications:
        assert notification.type == "comment_added"
        assert notification.card_id == card.id
        assert notification.board_id == board.id
        assert "Write docs" in notification.message


def test_comment_by_the_creator_who_is_also_assignee_notifies_nobody(
    client, card, test_user, auth_headers
):
    card.assignee_id = test_user.id
    db.session.commit()

    post(client, auth_headers(test_user), card.id, content="Note to self")

    assert db.session.query(Notification).count() == 0


def test_comment_notifies_a_person_once_when_creator_is_also_assignee(
    client, card, test_user, test_user_2, auth_headers
):
    card.assignee_id = test_user.id
    db.session.commit()

    post(client, auth_headers(test_user_2), card.id, content="Ping")

    assert [n.user_id for n in db.session.query(Notification)] == [test_user.id]


def test_rejected_comment_creates_no_notification(client, card, test_user_2, auth_headers):
    post(client, auth_headers(test_user_2), card.id, content="")

    assert db.session.query(Notification).count() == 0


# --- GET /api/cards/<id>/comments ----------------------------------------------


def test_list_comments_returns_them_oldest_first_with_authors(
    client, card, test_user, test_user_2, auth_headers
):
    now = datetime.now(timezone.utc)
    add_comment(card, test_user, "Third", created_at=now)
    add_comment(card, test_user_2, "First", created_at=now - timedelta(hours=2))
    add_comment(card, test_user, "Second", created_at=now - timedelta(hours=1))

    res = client.get(f"/api/cards/{card.id}/comments", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert [item["content"] for item in data] == ["First", "Second", "Third"]
    assert data[0]["author"] == {"id": str(test_user_2.id), "name": "Bob Member"}
    assert data[1]["author"] == {"id": str(test_user.id), "name": "Alice Admin"}


def test_list_comments_returns_only_this_cards_comments(
    client, board, card, test_user, auth_headers
):
    other = add_card(add_column(board, "Doing", 2048), test_user, "Other card", 1024)
    add_comment(card, test_user, "Here")
    add_comment(other, test_user, "Elsewhere")

    res = client.get(f"/api/cards/{card.id}/comments", headers=auth_headers(test_user))

    assert [item["content"] for item in res.get_json()["data"]] == ["Here"]


def test_list_comments_uses_a_fixed_number_of_queries(
    client, card, test_user, test_user_2, auth_headers, count_queries
):
    headers = auth_headers(test_user)
    url = f"/api/cards/{card.id}/comments"
    card_id, user_ids = card.id, [test_user.id, test_user_2.id]

    def add_comments(count):
        target = db.session.get(Card, card_id)
        users = [db.session.get(User, user_id) for user_id in user_ids]
        for index in range(count):
            add_comment(target, users[index % 2], f"Comment {index}")
        db.session.expunge_all()

    add_comments(1)
    _, small = count_queries(lambda: client.get(url, headers=headers))
    add_comments(9)
    res, large = count_queries(lambda: client.get(url, headers=headers))

    assert len(res.get_json()["data"]) == 10
    assert small == 3  # card with its column; membership; comments with authors
    assert large == small


def test_list_comments_on_deleted_card_returns_404(client, card, comment, test_user, auth_headers):
    soft_delete(card)

    res = client.get(f"/api/cards/{card.id}/comments", headers=auth_headers(test_user))

    assert_error(res, 404)


def test_list_comments_as_non_member_returns_404(client, card, comment, test_user_3, auth_headers):
    res = client.get(f"/api/cards/{card.id}/comments", headers=auth_headers(test_user_3))

    assert_error(res, 404)


def test_list_comments_without_token_returns_401(client, card):
    assert_error(client.get(f"/api/cards/{card.id}/comments"), 401)


# --- PATCH /api/comments/<id> --------------------------------------------------


def test_update_comment_by_author_returns_200(client, comment, test_user_2, auth_headers):
    res = client.patch(
        f"/api/comments/{comment.id}", json={"content": "Edited"}, headers=auth_headers(test_user_2)
    )

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["id"] == str(comment.id)
    assert data["content"] == "Edited"
    assert data["author"] == {"id": str(test_user_2.id), "name": "Bob Member"}


def test_update_comment_by_non_author_returns_403_even_for_an_admin(
    client, comment, test_user, auth_headers
):
    res = client.patch(
        f"/api/comments/{comment.id}", json={"content": "Hijacked"}, headers=auth_headers(test_user)
    )

    assert_error(res, 403)
    db.session.expire_all()
    assert comment.content == "Original text"


@pytest.mark.parametrize("body", [{}, {"content": ""}, {"content": "x" * 2001}])
def test_update_comment_with_invalid_content_returns_400(
    client, comment, test_user_2, auth_headers, body
):
    res = client.patch(f"/api/comments/{comment.id}", json=body, headers=auth_headers(test_user_2))

    assert assert_error(res, 400).startswith("content:")
    db.session.expire_all()
    assert comment.content == "Original text"


def test_update_comment_without_token_returns_401(client, comment):
    assert_error(client.patch(f"/api/comments/{comment.id}", json={"content": "x"}), 401)


def test_update_comment_as_non_member_returns_same_404_as_unknown_comment(
    client, comment, test_user_3, auth_headers
):
    headers = auth_headers(test_user_3)

    not_member = client.patch(f"/api/comments/{comment.id}", json={"content": "x"}, headers=headers)
    unknown = client.patch(f"/api/comments/{uuid.uuid4()}", json={"content": "x"}, headers=headers)

    assert assert_error(not_member, 404) == assert_error(unknown, 404)
    db.session.expire_all()
    assert comment.content == "Original text"


def test_update_comment_on_deleted_card_returns_404(
    client, card, comment, test_user_2, auth_headers
):
    soft_delete(card)

    res = client.patch(
        f"/api/comments/{comment.id}", json={"content": "Edited"}, headers=auth_headers(test_user_2)
    )

    assert_error(res, 404)
    db.session.expire_all()
    assert comment.content == "Original text"


# --- DELETE /api/comments/<id> -------------------------------------------------


def test_delete_comment_by_author_returns_200(client, comment, test_user_2, auth_headers):
    comment_id = comment.id

    res = client.delete(f"/api/comments/{comment_id}", headers=auth_headers(test_user_2))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"id": str(comment_id)}}
    assert db.session.query(Comment).count() == 0


def test_delete_comment_by_non_author_returns_403(client, comment, test_user, auth_headers):
    res = client.delete(f"/api/comments/{comment.id}", headers=auth_headers(test_user))

    assert_error(res, 403)
    assert db.session.query(Comment).count() == 1


def test_delete_comment_as_non_member_returns_404(client, comment, test_user_3, auth_headers):
    res = client.delete(f"/api/comments/{comment.id}", headers=auth_headers(test_user_3))

    assert_error(res, 404)
    assert db.session.query(Comment).count() == 1


def test_delete_comment_without_token_returns_401(client, comment):
    assert_error(client.delete(f"/api/comments/{comment.id}"), 401)
    assert db.session.query(Comment).count() == 1
