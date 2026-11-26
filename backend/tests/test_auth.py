"""Register and login (REQ-2, REQ-3)."""

import uuid
from datetime import timedelta

import pytest
from flask_jwt_extended import decode_token

from app.extensions import db
from app.models import User
from tests.conftest import TEST_PASSWORD

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"
VALID = {"name": "Dana New", "email": "dana@example.com", "password": "password123"}


def assert_error(res, status):
    assert res.status_code == status
    body = res.get_json()
    assert set(body) == {"error"}
    assert isinstance(body["error"], str) and body["error"]
    return body["error"]


# --- POST /api/auth/register ---------------------------------------------------


def test_register_returns_201_with_public_user_fields(client):
    res = client.post(REGISTER, json=VALID)

    assert res.status_code == 201
    data = res.get_json()["data"]
    assert set(data) == {"id", "name", "email"}
    assert uuid.UUID(data["id"])
    assert data["name"] == "Dana New"
    assert data["email"] == "dana@example.com"


def test_register_stores_a_hash_not_the_password(client):
    client.post(REGISTER, json=VALID)

    user = db.session.query(User).filter_by(email="dana@example.com").one()
    assert user.password_hash != VALID["password"]
    assert VALID["password"] not in user.password_hash
    assert user.check_password(VALID["password"])


def test_register_duplicate_email_returns_409(client, test_user):
    res = client.post(REGISTER, json={**VALID, "email": test_user.email})

    assert_error(res, 409)
    assert db.session.query(User).count() == 1


def test_register_duplicate_email_in_other_case_returns_409(client, test_user):
    res = client.post(REGISTER, json={**VALID, "email": test_user.email.upper()})

    assert_error(res, 409)


@pytest.mark.parametrize("missing", ["name", "email", "password"])
def test_register_missing_field_returns_400_naming_it(client, missing):
    body = {key: value for key, value in VALID.items() if key != missing}

    message = assert_error(client.post(REGISTER, json=body), 400)

    assert message.startswith(f"{missing}:")
    assert db.session.query(User).count() == 0


def test_register_short_password_returns_400(client):
    res = client.post(REGISTER, json={**VALID, "password": "1234567"})

    assert assert_error(res, 400).startswith("password:")


def test_register_accepts_password_of_exactly_8_characters(client):
    res = client.post(REGISTER, json={**VALID, "password": "12345678"})

    assert res.status_code == 201
    assert "data" in res.get_json()


def test_register_invalid_email_returns_400(client):
    res = client.post(REGISTER, json={**VALID, "email": "not-an-email"})

    assert assert_error(res, 400).startswith("email:")


def test_register_name_longer_than_100_returns_400(client):
    res = client.post(REGISTER, json={**VALID, "name": "x" * 101})

    assert assert_error(res, 400).startswith("name:")


def test_register_name_of_only_spaces_returns_400(client):
    res = client.post(REGISTER, json={**VALID, "name": "   "})

    assert assert_error(res, 400).startswith("name:")


def test_register_trims_the_name(client):
    res = client.post(REGISTER, json={**VALID, "name": "  Dana New  "})

    assert res.status_code == 201
    assert res.get_json()["data"]["name"] == "Dana New"


# --- POST /api/auth/login ------------------------------------------------------


def test_login_returns_200_with_token_and_user(client, test_user):
    res = client.post(LOGIN, json={"email": test_user.email, "password": TEST_PASSWORD})

    assert res.status_code == 200
    data = res.get_json()["data"]
    assert set(data) == {"access_token", "user"}
    assert data["user"] == {
        "id": str(test_user.id),
        "name": test_user.name,
        "email": test_user.email,
    }


def test_login_token_identifies_the_user_and_expires_in_24_hours(client, test_user):
    res = client.post(LOGIN, json={"email": test_user.email, "password": TEST_PASSWORD})

    claims = decode_token(res.get_json()["data"]["access_token"])
    assert claims["sub"] == str(test_user.id)
    assert claims["exp"] - claims["iat"] == timedelta(hours=24).total_seconds()


def test_login_token_is_accepted_by_a_protected_route(client, test_user):
    token = client.post(
        LOGIN, json={"email": test_user.email, "password": TEST_PASSWORD}
    ).get_json()["data"]["access_token"]

    res = client.get("/api/_probe/protected", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    assert res.get_json() == {"data": {"ok": True}}


def test_login_wrong_password_returns_401(client, test_user):
    res = client.post(LOGIN, json={"email": test_user.email, "password": "wrong-password"})

    assert_error(res, 401)


def test_login_unknown_email_returns_same_401_as_wrong_password(client, test_user):
    wrong_password = client.post(LOGIN, json={"email": test_user.email, "password": "nope-nope"})
    unknown_email = client.post(LOGIN, json={"email": "ghost@example.com", "password": "nope-nope"})

    assert assert_error(unknown_email, 401) == assert_error(wrong_password, 401)


@pytest.mark.parametrize("missing", ["email", "password"])
def test_login_missing_field_returns_400_naming_it(client, test_user, missing):
    body = {"email": test_user.email, "password": TEST_PASSWORD}
    del body[missing]

    assert assert_error(client.post(LOGIN, json=body), 400).startswith(f"{missing}:")


def test_register_then_login_works_end_to_end(client):
    client.post(REGISTER, json=VALID)

    res = client.post(LOGIN, json={"email": "DANA@example.com", "password": VALID["password"]})

    assert res.status_code == 200
    assert res.get_json()["data"]["user"]["email"] == "dana@example.com"
