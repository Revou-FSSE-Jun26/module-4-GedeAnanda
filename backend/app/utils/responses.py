"""Success response helper (guidelines BE-02, BE-11)."""

from flask import jsonify


def success(data, status: int = 200):
    """Wrap ``data`` in the success envelope: ``{ "data": ... }``."""
    return jsonify({"data": data}), status
