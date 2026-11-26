"""Application exception raised by the service layer (guidelines BE-03, BE-11)."""


class AppError(Exception):
    """A business error that maps to an HTTP status and an error message.

    Services raise it; the handler in ``app.error_handlers`` turns it into
    ``{ "error": message }`` with ``status_code``.
    """

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
