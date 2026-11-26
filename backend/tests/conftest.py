"""Shared pytest fixtures.

Tests run against a separate PostgreSQL database (``TEST_DATABASE_URL``), never SQLite:
SQLite drops timezone info and does not enforce ``ON DELETE SET NULL``.
"""

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import Board, BoardMember, User
from tests.probes import register_probe_routes

TEST_PASSWORD = "password123"


@pytest.fixture(scope="session")
def app():
    app = create_app(TestConfig())
    register_probe_routes(app)
    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def clean_database(app):
    """Give every test an empty database."""
    yield
    db.session.rollback()
    for table in reversed(db.metadata.sorted_tables):
        db.session.execute(table.delete())
    db.session.commit()
    db.session.remove()


@pytest.fixture
def client(app):
    return app.test_client()


def make_user(name: str, email: str) -> User:
    user = User(name=name, email=email)
    user.set_password(TEST_PASSWORD)
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def test_user(app):
    return make_user("Alice Admin", "alice@example.com")


@pytest.fixture
def test_user_2(app):
    return make_user("Bob Member", "bob@example.com")


@pytest.fixture
def test_user_3(app):
    return make_user("Carol Outsider", "carol@example.com")


def make_board(owner: User, name: str = "Sprint Board", members=()) -> Board:
    """Create a board owned by ``owner`` (admin), plus ``(user, role)`` pairs as members."""
    board = Board(name=name, owner_id=owner.id)
    db.session.add(board)
    db.session.add(BoardMember(board=board, user_id=owner.id, role="admin"))
    for user, role in members:
        db.session.add(BoardMember(board=board, user_id=user.id, role=role))
    db.session.commit()
    return board


@pytest.fixture
def board(test_user, test_user_2):
    """Alice is the admin, Bob is a member. Carol (``test_user_3``) is not on the board."""
    return make_board(test_user, members=[(test_user_2, "member")])


@pytest.fixture
def auth_headers(app):
    """Return a function that builds an ``Authorization`` header for a user."""

    def build(user: User) -> dict[str, str]:
        token = create_access_token(identity=str(user.id))
        return {"Authorization": f"Bearer {token}"}

    return build
