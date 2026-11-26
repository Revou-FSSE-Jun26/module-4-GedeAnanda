"""The API always answers in the JSON envelope, never with HTML or a stack trace (REQ-17).

The ``/api/_probe/*`` routes are test-only and are registered in ``tests/probes.py``.
"""

from datetime import timedelta

from flask_jwt_extended import create_access_token


def assert_error_envelope(res, status):
    assert res.status_code == status
    assert res.content_type == "application/json"
    body = res.get_json()
    assert set(body) == {"error"}
    assert isinstance(body["error"], str) and body["error"]
    return body["error"]


def test_unknown_route_returns_404_envelope(client):
    assert_error_envelope(client.get("/api/does-not-exist"), 404)


def test_wrong_method_returns_405_envelope(client):
    assert_error_envelope(client.delete("/api/health"), 405)


def test_app_error_uses_its_status_and_message(client):
    message = assert_error_envelope(client.get("/api/_probe/app-error"), 409)
    assert message == "Already exists"


def test_unhandled_exception_returns_500_without_details(client, app):
    app.config["PROPAGATE_EXCEPTIONS"] = False
    try:
        res = client.get("/api/_probe/boom")
    finally:
        app.config["PROPAGATE_EXCEPTIONS"] = None

    message = assert_error_envelope(res, 500)
    assert "secret internal detail" not in message
    assert b"Traceback" not in res.data


def test_validation_error_returns_400_naming_the_field(client):
    res = client.post("/api/_probe/echo", json={"title": "far too long"})

    message = assert_error_envelope(res, 400)
    assert message.startswith("title:")


def test_missing_required_field_returns_400(client):
    assert_error_envelope(client.post("/api/_probe/echo", json={}), 400)


def test_malformed_json_returns_400_not_500(client):
    res = client.post(
        "/api/_probe/echo", data="{not json", content_type="application/json"
    )

    assert_error_envelope(res, 400)


def test_non_json_body_returns_415_not_500(client):
    res = client.post("/api/_probe/echo", data="title=x", content_type="text/plain")

    assert_error_envelope(res, 415)


def test_missing_token_returns_401_envelope(client):
    assert_error_envelope(client.get("/api/_probe/protected"), 401)


def test_malformed_token_returns_401_not_422(client):
    res = client.get("/api/_probe/protected", headers={"Authorization": "Bearer not-a-jwt"})

    assert_error_envelope(res, 401)


def test_expired_token_returns_401_envelope(client, test_user):
    token = create_access_token(identity=str(test_user.id), expires_delta=timedelta(seconds=-1))

    res = client.get("/api/_probe/protected", headers={"Authorization": f"Bearer {token}"})

    assert_error_envelope(res, 401)


def test_valid_token_is_accepted(client, test_user, auth_headers):
    res = client.get("/api/_probe/protected", headers=auth_headers(test_user))

    assert res.status_code == 200
    assert res.get_json() == {"data": {"ok": True}}
