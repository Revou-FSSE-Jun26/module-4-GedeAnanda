"""WSGI entry point.

Vercel detects the Flask ``app`` exported here and serves it as a function.
Locally: ``flask --app wsgi run --port 5001``.
"""

from app import create_app

app = create_app()
