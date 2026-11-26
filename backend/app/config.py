"""Application configuration.

This is the only module that reads environment variables (guideline BE-08).
Every variable is required: a missing one fails at startup instead of falling
back to an unsafe default.
"""

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


PSYCOPG2_SCHEME = "postgresql+psycopg2://"


def normalize_database_url(url: str) -> str:
    """Return a URL that SQLAlchemy opens with the psycopg2 driver.

    Railway issues ``postgres://`` URLs, which SQLAlchemy does not accept. A bare
    ``postgresql://`` URL makes SQLAlchemy 2.1 look for psycopg 3, which is not
    installed, so the driver is named explicitly.
    """
    for scheme in ("postgres://", "postgresql://"):
        if url.startswith(scheme):
            return PSYCOPG2_SCHEME + url[len(scheme):]
    return url


def parse_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Config:
    """Runtime configuration, read from the environment when instantiated."""

    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    def __init__(self) -> None:
        self.SECRET_KEY = os.environ["SECRET_KEY"]
        self.JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
        self.CORS_ORIGINS = parse_origins(os.environ["CORS_ORIGINS"])
        self.DEBUG = os.environ["FLASK_ENV"] == "development"
        self.SQLALCHEMY_DATABASE_URI = normalize_database_url(self.database_url())

    def database_url(self) -> str:
        return os.environ["DATABASE_URL"]


class TestConfig(Config):
    """Configuration for pytest: a separate PostgreSQL database."""

    TESTING = True

    def database_url(self) -> str:
        return os.environ["TEST_DATABASE_URL"]
