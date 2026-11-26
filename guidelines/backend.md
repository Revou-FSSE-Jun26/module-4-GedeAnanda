# Backend Guidelines (Flask API)

Scope: everything under `backend/app/` except the model definitions and query patterns, which belong to [`database.md`](database.md). Frontend rules are in [`frontend.md`](frontend.md).

Every guideline has an ID (`BE-xx`) so reviews and the violation report can cite it. Each one has three parts: **Rule**, **Rationale**, **Example**.

---

## BE-01 — One blueprint per feature, split into three files

**Rule.** Each feature lives in `backend/app/blueprints/<feature>/` with exactly these responsibilities:

- `routes.py`: read the HTTP request, call one service function, return the response.
- `service.py`: business logic, authorization and database access.
- `schema.py`: Marshmallow schemas for input validation and output serialization.

A route function never queries the database, and a service function never touches `request` or builds a response.

**Rationale.** When HTTP handling and business logic are mixed, the logic cannot be reused or tested without a request context, and authorization checks end up duplicated or forgotten.

**Example.**

```python
# backend/app/blueprints/comments/routes.py
@comments_bp.post("/api/cards/<uuid:card_id>/comments")
@jwt_required()
def create_comment(card_id):
    data = CommentSchema().load(request.get_json())
    comment = service.create_comment(current_user_id(), card_id, data)
    return success(CommentOut().dump(comment), 201)
```

```python
# Wrong: query and business rule inside the route
@comments_bp.post("/api/cards/<uuid:card_id>/comments")
def create_comment(card_id):
    card = Card.query.get(card_id)          # database access in routes.py
    if card.deleted_at: ...                 # business rule in routes.py
```

---

## BE-02 — Every response uses the JSON envelope helpers

**Rule.** Routes return responses only through `success(data, status=200)` and the app-factory error handlers. Success is `{ "data": ... }`; errors are `{ "error": "<message>" }`. Creation returns `201`; everything else, including delete, returns `200`. Delete returns `{ "data": { "id": "<uuid>" } }`. Never return `204`, a bare list, a bare string, or `jsonify(...)` directly.

**Rationale.** The frontend's `apiClient` parses one shape. A single endpoint that returns a different shape breaks error handling for that screen only, which is hard to notice in review.

**Example.**

```python
# backend/app/utils/responses.py
def success(data, status=200):
    return jsonify({"data": data}), status

# DELETE /api/cards/<id>
return success({"id": str(card.id)})          # 200 { "data": { "id": "..." } }
```

```python
return "", 204                                 # Wrong: no envelope
return jsonify(CardOut().dump(card))           # Wrong: no "data" key
```

---

## BE-03 — Business errors are raised as `AppError`, never caught in routes

**Rule.** A service function signals a business error by raising `AppError(status_code, message)`. `routes.py` contains no `try/except` for business errors and never builds an error response itself. The app factory owns the handlers for `AppError`, `ValidationError`, `HTTPException` and unhandled `Exception`.

**Rationale.** One handler guarantees one error shape. `try/except` blocks in routes drift apart over time, and a broad `except Exception` in a route hides real bugs as `400`s.

**Example.**

```python
# backend/app/blueprints/comments/service.py
def update_comment(user_id, comment_id, data):
    comment = get_comment_for_member(user_id, comment_id)   # raises AppError(404, ...)
    if comment.author_id != user_id:
        raise AppError(403, "You can only edit your own comments")
    comment.content = data["content"]
    db.session.commit()
    return comment
```

```python
# Wrong
try:
    comment = service.update_comment(...)
except Exception as e:
    return jsonify({"message": str(e)}), 400
```

---

## BE-04 — Validate every input with a Marshmallow schema before calling the service

**Rule.** Every request body and every set of query parameters is loaded through a schema in `schema.py` (`Schema().load(...)`) before the service is called. Services receive the validated dict, never `request.json` or `request.args`. Length limits, enums and ranges are declared in the schema, not checked by hand in the service.

**Rationale.** Hand-written `if not data.get("title")` checks are incomplete and inconsistent. A schema makes the contract visible in one place and produces the same `400` for every field.

**Example.**

```python
# backend/app/blueprints/cards/schema.py
class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0, min_inclusive=False))

# routes.py
data = CardPositionSchema().load(request.get_json())
result = service.move_card(current_user_id(), card_id, data)
```

```python
# Wrong: manual validation
order = request.json.get("order")
if order is None or order <= 0:
    return jsonify({"error": "bad order"}), 400
```

---

## BE-05 — Serialize responses only through output (`…Out`) schemas

**Rule.** Model instances are converted to JSON only by a dump schema (`UserOut`, `BoardOut`, `ColumnOut`, `CardOut`, `CommentOut`, `NotificationOut`, `MemberOut`). Never return `model.__dict__`, a hand-built dict of model fields, or a schema that includes `password_hash`.

**Rationale.** An explicit output schema is an allow-list. A hand-built dict or `__dict__` leaks whatever columns exist today or are added later, including the password hash.

**Example.**

```python
# backend/app/blueprints/users/schema.py
class UserOut(Schema):
    id = fields.UUID()
    name = fields.String()
    email = fields.Email()

# GET /api/users/me
return success(UserOut().dump(user))
```

```python
# Wrong: leaks password_hash and internal fields
return success({k: v for k, v in user.__dict__.items() if not k.startswith("_")})
```

---

## BE-06 — Authorization lives in the service layer: 404 for non-members, 403 for role or ownership

**Rule.** Every service function that touches a board, column, card, comment or member list first resolves the caller's `BoardMember` row.

- No membership: raise `AppError(404, ...)`, so the board's existence is not revealed.
- Member without the required role or ownership: raise `AppError(403, ...)`.

Use the shared helpers `require_member(user_id, board_id)` and `require_admin(user_id, board_id)` instead of repeating the query.

**Rationale.** Authorization in the service cannot be skipped by adding a new route. Returning `403` to non-members would confirm that a board ID exists.

**Example.**

```python
# backend/app/blueprints/analytics/service.py
def get_analytics(user_id, board_id):
    require_admin(user_id, board_id)   # 404 if not a member, 403 if member but not admin
    ...
```

```python
# Wrong: role check in the route, and 403 for a non-member
if not is_admin(get_jwt_identity(), board_id):
    return jsonify({"error": "forbidden"}), 403
```

---

## BE-07 — The caller's identity comes only from the JWT

**Rule.** Every route except `POST /api/auth/register`, `POST /api/auth/login` and `GET /api/health` is decorated with `@jwt_required()`. The current user ID is read with `get_jwt_identity()` (through the `current_user_id()` helper) and passed to the service. A user ID is never taken from the request body, query string or URL to decide who is acting.

**Rationale.** If `author_id` or `user_id` is accepted from the client, any logged-in user can act as someone else.

**Example.**

```python
# POST /api/cards/<id>/comments — author comes from the token
comment = service.create_comment(current_user_id(), card_id, data)
```

```python
# Wrong: client chooses the author
comment = Comment(card_id=card_id, author_id=request.json["author_id"], ...)
```

---

## BE-08 — Configuration comes only from environment variables

**Rule.** `backend/app/config.py` is the only module that reads `os.environ`. Secrets, the database URL, the CORS origins and the JWT lifetime are never written as literals in code, including as "default" fallbacks. Every variable is listed in `backend/.env.example` with a placeholder value. Real `.env` files are never committed.

**Rationale.** A hardcoded fallback secret works locally and then ships to production unnoticed. Listing variables in `.env.example` is how the next person, and the deploy platform, know what must be set.

**Example.**

```python
# backend/app/config.py
class Config:
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]                 # fails fast if missing
    CORS_ORIGINS = os.environ["CORS_ORIGINS"].split(",")
    SQLALCHEMY_DATABASE_URI = _normalize(os.environ["DATABASE_URL"])   # postgres:// → postgresql://
```

```python
# Wrong
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-123")
CORS(app, origins="*")
```

---

## BE-09 — Cross-feature side effects go through the owning blueprint's service

**Rule.** When one feature needs another feature's behavior, it calls that feature's service function. Notifications are created only through `notifications.service.create_notification(...)`. A service never constructs another blueprint's model directly, and never notifies the user who performed the action.

**Rationale.** If three blueprints each build `Notification(...)` themselves, the "do not notify the actor" rule has to be remembered in three places, and it will be missed in one of them.

**Example.**

```python
# backend/app/blueprints/comments/service.py
from app.blueprints.notifications import service as notifications

for recipient_id in {card.created_by, card.assignee_id} - {None, user_id}:
    notifications.create_notification(
        recipient_id, "comment_added", f"New comment on '{card.title}'", card_id=card.id
    )
```

```python
# Wrong: builds the model directly and notifies the commenter too
db.session.add(Notification(user_id=card.created_by, type="comment_added", ...))
```

---

## BE-10 — Every endpoint has pytest coverage for success and each applicable error

**Rule.** Each blueprint has `backend/tests/test_<blueprint>.py`. For every endpoint there is one test for the success path and one test for each status code it can return (`400`, `401`, `403`, `404`, `409`). Tests use the fixtures in `conftest.py`, call the API through the Flask test client, and assert on both the status code and the envelope body. A test never asserts only `status_code == 200`.

**Rationale.** Error paths are where authorization bugs hide. A test that only checks the status code passes even when the body is the wrong shape.

**Example.**

```python
# backend/tests/test_comments.py
def test_update_comment_by_non_author_returns_403(client, comment, auth_headers, test_user_2):
    res = client.patch(f"/api/comments/{comment.id}",
                       json={"content": "edited"}, headers=auth_headers(test_user_2))
    assert res.status_code == 403
    assert "error" in res.get_json()
    assert "data" not in res.get_json()
```
