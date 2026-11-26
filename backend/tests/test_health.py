from sqlalchemy.exc import OperationalError

from app.extensions import db


def test_health_returns_200_with_ok_status(client):
    res = client.get("/api/health")

    assert res.status_code == 200
    assert res.get_json() == {"data": {"status": "ok"}}


def test_health_needs_no_token(client):
    res = client.get("/api/health")

    assert res.status_code == 200


def test_health_returns_503_when_database_is_unreachable(client, monkeypatch):
    def fail(*args, **kwargs):
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(db.session, "execute", fail)

    res = client.get("/api/health")

    assert res.status_code == 503
    assert res.get_json() == {"error": "database unavailable"}
