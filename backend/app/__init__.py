"""RevoTask API application factory."""

from flask import Flask
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import Config
from app.error_handlers import register_error_handlers, register_jwt_handlers
from app.exceptions import AppError
from app.extensions import cors, db, jwt, migrate
from app.utils.responses import success


def create_app(config: Config | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config or Config())

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Imported for its side effect: registers every model with SQLAlchemy and Flask-Migrate.
    from app import models  # noqa: F401

    register_error_handlers(app)
    register_jwt_handlers()
    register_health(app)

    return app


def register_health(app: Flask) -> None:
    @app.get("/api/health")
    def health():
        try:
            db.session.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            app.logger.error("Health check failed: %s", error)
            raise AppError(503, "database unavailable") from error
        return success({"status": "ok"})
