"""Profile read and update (REQ-14) and Property 6: no password in any response."""

import pytest

from app.blueprints.users.schema import UserOut
from app.extensions import db
from app.models import User
from tests.conftest import TEST_PASSWORD
from tests.helpers import assert_error

URL = "/api/users/me"
FORBIDDEN_KEYS = {"password", "password_hash"}


def assert_no_password(res):
    """Property 6: neither key appears anywhere in the response body."""
    text = res.get_data(as_text=True)
    assert "password_hash" not in text
    body = res.get_json()
    if isinstance(body.get("data"), dict):
        assert not FORBIDDEN_KEYS & set(body["data"])
    return res


def test_user_out_schema_has_no_password_fields():
    assert set(UserOut().fields) == {"id", "name", "email"}


# --- GET /api/users/me ---------------------------------------------------------


def test_get_me_returns_id_name_and_email_only(client, test_user, test_user_2, auth_headers):
    res = assert_no_password(client.get(URL, headers=auth_headers(test_user)))

    assert res.status_code == 200
    assert res.get_json() == {
        "data": {"id": str(test_user.id), "name": "Alice Admin", "email": "alice@example.com"}
    }


def test_get_me_without_token_returns_401(client):
    assert_error(assert_no_password(client.get(URL)), 401)


# --- PATCH /api/users/me -------------------------------------------------------


def test_update_me_changes_name_and_email(client, test_user, auth_headers):
    res = assert_no_password(
        client.patch(
            URL,
            json={"name": "  Alice Renamed ", "email": "Alice.New@Example.com"},
            headers=auth_headers(test_user),
        )
    )

    assert res.status_code == 200
    assert res.get_json() == {
        "data": {"id": str(test_user.id), "name": "Alice Renamed", "email": "alice.new@example.com"}
    }
    db.session.expire_all()
    assert (test_user.name, test_user.email) == ("Alice Renamed", "alice.new@example.com")


def test_update_me_with_only_a_name_keeps_the_email(client, test_user, auth_headers):
    res = assert_no_password(
        client.patch(URL, json={"name": "Just Alice"}, headers=auth_headers(test_user))
    )

    assert res.status_code == 200
    assert res.get_json()["data"]["email"] == "alice@example.com"


def test_update_me_can_resend_my_own_email(client, test_user, auth_headers):
    res = client.patch(URL, json={"email": "ALICE@example.com"}, headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json()["data"]["email"] == "alice@example.com"


def test_new_email_works_for_login_and_the_old_one_does_not(client, test_user, auth_headers):
    client.patch(URL, json={"email": "alice.new@example.com"}, headers=auth_headers(test_user))

    new = client.post(
        "/api/auth/login", json={"email": "alice.new@example.com", "password": TEST_PASSWORD}
    )
    old = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": TEST_PASSWORD}
    )

    assert assert_no_password(new).status_code == 200
    assert_error(old, 401)


@pytest.mark.parametrize("email", ["bob@example.com", "BOB@Example.com"])
def test_update_me_with_email_of_another_account_returns_409(
    client, test_user, test_user_2, auth_headers, email
):
    res = assert_no_password(
        client.patch(URL, json={"name": "Sneaky", "email": email}, headers=auth_headers(test_user))
    )

    assert_error(res, 409)
    db.session.expire_all()
    assert (test_user.name, test_user.email) == ("Alice Admin", "alice@example.com")


@pytest.mark.parametrize(
    "body",
    [{"password": "new-password-1"}, {"name": "Alice", "password": "new-password-1"}],
)
def test_update_me_with_password_returns_400_and_keeps_the_password(
    client, test_user, auth_headers, body
):
    res = assert_no_password(client.patch(URL, json=body, headers=auth_headers(test_user)))

    assert assert_error(res, 400).startswith("password:")
    db.session.expire_all()
    assert test_user.check_password(TEST_PASSWORD)
    assert test_user.name == "Alice Admin"


@pytest.mark.parametrize(
    "body, field",
    [
        ({"email": "not-an-email"}, "email"),
        ({"name": ""}, "name"),
        ({"name": "   "}, "name"),
        ({"name": "x" * 101}, "name"),
        ({"id": "11111111-1111-1111-1111-111111111111"}, "id"),
    ],
)
def test_update_me_with_invalid_body_returns_400(client, test_user, auth_headers, body, field):
    res = assert_no_password(client.patch(URL, json=body, headers=auth_headers(test_user)))

    assert assert_error(res, 400).startswith(f"{field}:")
    db.session.expire_all()
    assert (test_user.name, test_user.email) == ("Alice Admin", "alice@example.com")


def test_update_me_with_empty_body_returns_400(client, test_user, auth_headers):
    assert_error(client.patch(URL, json={}, headers=auth_headers(test_user)), 400)


def test_update_me_changes_only_my_account(client, test_user, test_user_2, auth_headers):
    client.patch(URL, json={"name": "Changed"}, headers=auth_headers(test_user))

    db.session.expire_all()
    assert db.session.get(User, test_user_2.id).name == "Bob Member"


def test_update_me_without_token_returns_401(client, test_user):
    assert_error(assert_no_password(client.patch(URL, json={"name": "x"})), 401)
    db.session.expire_all()
    assert test_user.name == "Alice Admin"


# --- Property 6 across the other endpoints that return users --------------------


def test_property_6_no_user_listing_endpoint_returns_a_password(
    client, board, test_user, auth_headers
):
    headers = auth_headers(test_user)
    responses = [
        client.post(
            "/api/auth/register",
            json={"name": "Dana", "email": "dana@example.com", "password": "password123"},
        ),
        client.post(
            "/api/auth/login", json={"email": "alice@example.com", "password": TEST_PASSWORD}
        ),
        client.get(f"/api/boards/{board.id}/members", headers=headers),
        client.get(f"/api/boards/{board.id}", headers=headers),
    ]

    for res in responses:
        assert res.status_code in (200, 201)
        text = res.get_data(as_text=True)
        assert "password" not in text.replace("access_token", "")
