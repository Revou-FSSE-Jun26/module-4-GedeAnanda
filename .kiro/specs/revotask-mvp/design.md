# Design Document — RevoTask MVP

## Overview

RevoTask is a Trello-like task management application composed of two deployables:

- **RevoTask API** — Flask REST API with PostgreSQL, deployed on Railway.
- **RevoTask Web** — Next.js (App Router) frontend, deployed on Vercel.

The API follows the app-factory + Blueprint pattern. Each feature lives in its own Blueprint and is split across three files: `routes.py` (HTTP handling), `service.py` (business logic and queries), and `schema.py` (Marshmallow validation and serialisation). All responses use the JSON envelope `{ "data": ... }` on success and `{ "error": "..." }` on failure.

The Web uses Server Components for data-heavy pages (dashboard, board detail) and Client Component islands for interactivity (drag-and-drop, modals, notifications). Authentication state flows through a `revotask_token` cookie (read by Server Components and `middleware.ts`) and an `AuthContext` (used by Client Components).

---

## Architecture

```mermaid
graph TD
    Browser["Browser (Next.js on Vercel)"]
    MW["middleware.ts\n(route protection)"]
    SC["Server Components\n(Dashboard, Board Detail)"]
    CC["Client Components\n(Kanban, Modals, Header)"]
    API["Flask API (Railway)"]
    PG["PostgreSQL (Railway)"]

    Browser -->|page request| MW
    MW -->|authenticated| SC
    SC -->|server-side fetch| API
    CC -->|client fetch via apiClient| API
    API -->|SQLAlchemy ORM| PG
```

**Request lifecycle:**

1. `middleware.ts` checks the `revotask_token` cookie. Unauthenticated requests to protected routes are redirected to `/login`.
2. Server Components call `lib/apiClient` with the token from `cookies()` before the HTML is sent to the client.
3. Client Components call `lib/apiClient` with the token from `AuthContext`.
4. `lib/apiClient` throws an `ApiError` on any non-2xx response; `useErrorHandler` maps it to a toast and, for 401, clears the session and redirects to `/login`.
5. Card moves update local state optimistically before the API responds, and roll back on error.

---

## Data Models

> *Section 1 of the design — Flask-SQLAlchemy model definitions.*

All models share a UUID primary key, `created_at`, and `updated_at`.

```python
# app/models/user.py
import uuid
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

class User(db.Model):
    __tablename__ = "users"

    id           = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = db.Column(db.String(100), nullable=False)
    email        = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    board_memberships = db.relationship("BoardMember", back_populates="user", cascade="all, delete-orphan")
    created_cards     = db.relationship("Card", foreign_keys="Card.created_by", back_populates="creator")
    assigned_cards    = db.relationship("Card", foreign_keys="Card.assignee_id", back_populates="assignee")
    comments          = db.relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    notifications     = db.relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)
```

```python
# app/models/board.py
import uuid
from datetime import datetime
from app.extensions import db

class Board(db.Model):
    __tablename__ = "boards"

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = db.Column(db.String(100), nullable=False)
    owner_id   = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner   = db.relationship("User", foreign_keys=[owner_id])
    members = db.relationship("BoardMember", back_populates="board", cascade="all, delete-orphan")
    columns = db.relationship("Column", back_populates="board", cascade="all, delete-orphan",
                               order_by="Column.order")
```

```python
# app/models/board_member.py
import uuid
from datetime import datetime
from app.extensions import db

class BoardMember(db.Model):
    __tablename__ = "board_members"
    __table_args__ = (db.UniqueConstraint("board_id", "user_id", name="uq_board_member"),)

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id   = db.Column(db.UUID(as_uuid=True), db.ForeignKey("boards.id"), nullable=False)
    user_id    = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    role       = db.Column(db.String(10), nullable=False)   # "admin" | "member"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    board = db.relationship("Board", back_populates="members")
    user  = db.relationship("User", back_populates="board_memberships")
```

```python
# app/models/column.py
import uuid
from datetime import datetime
from app.extensions import db

class Column(db.Model):
    __tablename__ = "columns"

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id   = db.Column(db.UUID(as_uuid=True), db.ForeignKey("boards.id"), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    order      = db.Column(db.Float, nullable=False)
    is_done    = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    board = db.relationship("Board", back_populates="columns")
    cards = db.relationship("Card", back_populates="column", cascade="all, delete-orphan",
                             order_by="Card.order")
```

```python
# app/models/card.py
import uuid
from datetime import datetime
from app.extensions import db

class Card(db.Model):
    __tablename__ = "cards"

    id           = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    column_id    = db.Column(db.UUID(as_uuid=True), db.ForeignKey("columns.id"), nullable=False)
    title        = db.Column(db.String(200), nullable=False)
    description  = db.Column(db.String(5000), nullable=True)
    assignee_id  = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    created_by   = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    due_date     = db.Column(db.Date, nullable=True)
    priority     = db.Column(db.String(10), default="medium", nullable=False)  # low|medium|high
    order        = db.Column(db.Float, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    deleted_at   = db.Column(db.DateTime, nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    column   = db.relationship("Column", back_populates="cards")
    creator  = db.relationship("User", foreign_keys=[created_by], back_populates="created_cards")
    assignee = db.relationship("User", foreign_keys=[assignee_id], back_populates="assigned_cards")
    comments = db.relationship("Comment", back_populates="card", cascade="all, delete-orphan")
```

```python
# app/models/comment.py
import uuid
from datetime import datetime
from app.extensions import db

class Comment(db.Model):
    __tablename__ = "comments"

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id    = db.Column(db.UUID(as_uuid=True), db.ForeignKey("cards.id"), nullable=False)
    author_id  = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    content    = db.Column(db.String(2000), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    card   = db.relationship("Card", back_populates="comments")
    author = db.relationship("User", back_populates="comments")
```

```python
# app/models/notification.py
import uuid
from datetime import datetime
from app.extensions import db

NOTIFICATION_TYPES = ("card_assigned", "comment_added", "board_invite")

class Notification(db.Model):
    __tablename__ = "notifications"

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    type       = db.Column(db.String(20), nullable=False)   # card_assigned | comment_added | board_invite
    message    = db.Column(db.String(500), nullable=False)
    is_read    = db.Column(db.Boolean, default=False, nullable=False)
    card_id    = db.Column(db.UUID(as_uuid=True), db.ForeignKey("cards.id"), nullable=True)
    board_id   = db.Column(db.UUID(as_uuid=True), db.ForeignKey("boards.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user  = db.relationship("User", back_populates="notifications")
    card  = db.relationship("Card")
    board = db.relationship("Board")
```

---

## Components and Interfaces

> *Section 2 of the design — API endpoint catalog with request/response contracts for every endpoint in Appendix A.*

## API Endpoint Catalog

### Health

#### `GET /api/health`

| Field | Value |
|-------|-------|
| Blueprint | *(app factory)* |
| Auth required | No |
| Request body | — |
| Success | `200 { "data": { "status": "ok" } }` |
| Errors | `503 { "error": "database unavailable" }` — database unreachable |

---

### Auth Blueprint

#### `POST /api/auth/register`

| Field | Value |
|-------|-------|
| Blueprint | auth |
| Auth required | No |
| Request body | `name` (string, required) · `email` (string, valid email, required) · `password` (string, min 8 chars, required) |
| Success | `201 { "data": { "id": "...", "name": "...", "email": "..." } }` |
| Errors | `400` — missing/invalid fields or password < 8 chars · `409` — email already registered |

#### `POST /api/auth/login`

| Field | Value |
|-------|-------|
| Blueprint | auth |
| Auth required | No |
| Request body | `email` (string, required) · `password` (string, required) |
| Success | `200 { "data": { "access_token": "<jwt>", "user": { "id": "...", "name": "...", "email": "..." } } }` |
| Errors | `400` — missing fields · `401` — invalid credentials |

---

### Boards Blueprint

#### `POST /api/boards`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes |
| Request body | `name` (string, required) |
| Success | `201 { "data": { "id": "...", "name": "...", "created_at": "..." } }` |
| Errors | `400` — missing name · `401` — no/invalid JWT |

#### `GET /api/boards`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes |
| Request body | — |
| Success | `200 { "data": [ { "id": "...", "name": "..." }, ... ] }` |
| Errors | `401` — no/invalid JWT |

#### `GET /api/boards/<id>`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes |
| Request body | — |
| Success | `200 { "data": { "id": "...", "name": "...", "columns": [ { "id": "...", "name": "...", "order": ..., "is_done": ..., "cards": [ ... ] } ] } }` — columns sorted by `order`; cards sorted by `order`; non-deleted cards only |
| Errors | `401` — no/invalid JWT · `404` — board not found or user not a member |

#### `PATCH /api/boards/<id>`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes (admin) |
| Request body | `name` (string, required) |
| Success | `200 { "data": { "id": "...", "name": "..." } }` |
| Errors | `400` — missing name · `401` — no/invalid JWT · `403` — not an admin · `404` — board not found or user not a member |

#### `DELETE /api/boards/<id>`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes (admin) |
| Request body | — |
| Success | `200 { "data": { "id": "<uuid>" } }` |
| Errors | `401` — no/invalid JWT · `403` — not an admin · `404` — board not found or user not a member |

#### `GET /api/boards/<id>/members`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes (any board member) |
| Request body | — |
| Success | `200 { "data": [ { "user_id": "...", "name": "...", "email": "...", "role": "..." }, ... ] }` |
| Errors | `401` — no/invalid JWT · `404` — board not found or user not a member |

#### `POST /api/boards/<id>/members`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes (admin) |
| Request body | `email` (string, required) · `role` (enum `admin`\|`member`, required) |
| Success | `201 { "data": { "user_id": "...", "name": "...", "email": "...", "role": "..." } }` |
| Errors | `400` — invalid role · `401` — no/invalid JWT · `403` — not an admin · `404` — board not found or user not a member; email not registered · `409` — user already a member |

#### `PATCH /api/boards/<id>/members/<user_id>`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes (admin) |
| Request body | `role` (enum `admin`\|`member`, required) |
| Success | `200 { "data": { "user_id": "...", "role": "..." } }` |
| Errors | `400` — invalid role; change would leave board with no admin · `401` — no/invalid JWT · `403` — not an admin · `404` — board not found or user not a member; target member not found |

#### `DELETE /api/boards/<id>/members/<user_id>`

| Field | Value |
|-------|-------|
| Blueprint | boards |
| Auth required | Yes (admin) |
| Request body | — |
| Success | `200 { "data": { "id": "<uuid>" } }` |
| Errors | `400` — removing last admin · `401` — no/invalid JWT · `403` — not an admin · `404` — board not found or user not a member; target member not found |

---

### Columns Blueprint

#### `POST /api/boards/<id>/columns`

| Field | Value |
|-------|-------|
| Blueprint | columns |
| Auth required | Yes (member or admin) |
| Request body | `name` (string, required) |
| Success | `201 { "data": { "id": "...", "name": "...", "order": ..., "is_done": false } }` |
| Errors | `400` — missing name · `401` — no/invalid JWT · `404` — board not found or user not a member |

#### `PATCH /api/columns/<id>`

| Field | Value |
|-------|-------|
| Blueprint | columns |
| Auth required | Yes (member or admin) |
| Request body | `name` (string, optional) · `is_done` (boolean, optional) |
| Success | `200 { "data": { "id": "...", "name": "...", "order": ..., "is_done": ... } }` |
| Errors | `400` — no valid fields · `401` — no/invalid JWT · `404` — column not found or user not a member of its board |

#### `DELETE /api/columns/<id>`

| Field | Value |
|-------|-------|
| Blueprint | columns |
| Auth required | Yes (admin) |
| Request body | — |
| Success | `200 { "data": { "id": "<uuid>" } }` |
| Errors | `401` — no/invalid JWT · `403` — not an admin · `404` — column not found or user not a member of its board |

#### `PATCH /api/boards/<id>/columns/reorder`

| Field | Value |
|-------|-------|
| Blueprint | columns |
| Auth required | Yes (member or admin) |
| Request body | `column_id` (UUID, required) · `order` (float > 0, required) |
| Success | `200 { "data": { "id": "...", "order": ... } }` |
| Errors | `400` — `column_id` not a valid UUID or not on this board; `order` not a float > 0 · `401` — no/invalid JWT · `404` — board not found or user not a member |

---

### Cards Blueprint

#### `GET /api/cards`

| Field | Value |
|-------|-------|
| Blueprint | cards |
| Auth required | Yes |
| Query params | `assignee=me` (optional) · `board_id` (UUID, optional) · `q` (string, optional) |
| Success | `200 { "data": [ { card fields... } ] }` — never includes soft-deleted cards |
| Errors | `401` — no/invalid JWT · `404` — `board_id` supplied but board not found or user not a member |

#### `POST /api/columns/<id>/cards`

| Field | Value |
|-------|-------|
| Blueprint | cards |
| Auth required | Yes (member or admin) |
| Request body | `title` (string 1–200, required) · `description` (string ≤ 5000, optional) · `assignee_id` (UUID, optional) · `due_date` (date, optional) · `priority` (enum `low`\|`medium`\|`high`, default `medium`, optional) |
| Success | `201 { "data": { card fields... } }` |
| Errors | `400` — title absent/out of range; description too long; invalid assignee; invalid priority · `401` — no/invalid JWT · `404` — column not found or user not a member of its board |

#### `PATCH /api/cards/<id>`

| Field | Value |
|-------|-------|
| Blueprint | cards |
| Auth required | Yes (member or admin) |
| Request body | `title` (string 1–200, optional) · `description` (string ≤ 5000, optional) · `assignee_id` (UUID, optional) · `due_date` (date, optional) · `priority` (enum, optional) |
| Success | `200 { "data": { card fields... } }` |
| Errors | `400` — validation failure · `401` — no/invalid JWT · `404` — card not found or user not a member of its board |

#### `DELETE /api/cards/<id>`

| Field | Value |
|-------|-------|
| Blueprint | cards |
| Auth required | Yes (member who created the card, or admin) |
| Request body | — |
| Success | `200 { "data": { "id": "<uuid>" } }` |
| Errors | `401` — no/invalid JWT · `403` — member did not create the card · `404` — card not found or user not a member of its board |

#### `PATCH /api/cards/<id>/position`

| Field | Value |
|-------|-------|
| Blueprint | cards |
| Auth required | Yes (member or admin) |
| Request body | `column_id` (UUID, required — must belong to same board) · `order` (float > 0, required) |
| Success | `200 { "data": { card fields including completed_at... } }` |
| Errors | `400` — `column_id` not a valid UUID, not on same board, or `order` ≤ 0 · `401` — no/invalid JWT · `404` — card not found or user not a member of its board |

---

### Comments Blueprint

#### `POST /api/cards/<id>/comments`

| Field | Value |
|-------|-------|
| Blueprint | comments |
| Auth required | Yes (member or admin) |
| Request body | `content` (string 1–2000, required) |
| Success | `201 { "data": { "id": "...", "card_id": "...", "author_id": "...", "content": "...", "created_at": "..." } }` |
| Errors | `400` — content absent or out of range · `401` — no/invalid JWT · `404` — card not found, soft-deleted, or user not a board member |

#### `GET /api/cards/<id>/comments`

| Field | Value |
|-------|-------|
| Blueprint | comments |
| Auth required | Yes (member or admin) |
| Request body | — |
| Success | `200 { "data": [ { comment fields... } ] }` — chronological order |
| Errors | `401` — no/invalid JWT · `404` — card not found, soft-deleted, or user not a board member |

#### `PATCH /api/comments/<id>`

| Field | Value |
|-------|-------|
| Blueprint | comments |
| Auth required | Yes (comment author) |
| Request body | `content` (string 1–2000, required) |
| Success | `200 { "data": { comment fields... } }` |
| Errors | `400` — content out of range · `401` — no/invalid JWT · `403` — not the author · `404` — comment not found or user not a board member |

#### `DELETE /api/comments/<id>`

| Field | Value |
|-------|-------|
| Blueprint | comments |
| Auth required | Yes (comment author) |
| Request body | — |
| Success | `200 { "data": { "id": "<uuid>" } }` |
| Errors | `401` — no/invalid JWT · `403` — not the author · `404` — comment not found or user not a board member |

---

### Notifications Blueprint

#### `GET /api/notifications`

| Field | Value |
|-------|-------|
| Blueprint | notifications |
| Auth required | Yes |
| Query params | `page` (int ≥ 1, default 1) · `per_page` (int 1–100, default 20) |
| Success | `200 { "data": { "items": [ { notification fields... } ], "page": 1, "per_page": 20, "total": 42, "unread_count": 3 } }` — reverse chronological order |
| Errors | `400` — `page` < 1 or `per_page` out of range · `401` — no/invalid JWT |

#### `PATCH /api/notifications/<id>/read`

| Field | Value |
|-------|-------|
| Blueprint | notifications |
| Auth required | Yes |
| Request body | — |
| Success | `200 { "data": { "id": "...", "is_read": true } }` |
| Errors | `401` — no/invalid JWT · `404` — notification not found or belongs to a different user |

---

### Analytics Blueprint

#### `GET /api/boards/<id>/analytics`

| Field | Value |
|-------|-------|
| Blueprint | analytics |
| Auth required | Yes (admin) |
| Request body | — |
| Success | `200 { "data": { "cards_per_column": [ { "column_id": "...", "column_name": "...", "count": ... } ], "completed_this_week": ..., "member_activity": [ { "user_id": "...", "name": "...", "cards_created": ..., "cards_assigned": ..., "comments_last_7_days": ... } ] } }` |
| Errors | `401` — no/invalid JWT · `403` — not an admin · `404` — board not found or user not a member |

---

### Users Blueprint

#### `GET /api/users/me`

| Field | Value |
|-------|-------|
| Blueprint | users |
| Auth required | Yes |
| Request body | — |
| Success | `200 { "data": { "id": "...", "name": "...", "email": "..." } }` — no password hash |
| Errors | `401` — no/invalid JWT |

#### `PATCH /api/users/me`

| Field | Value |
|-------|-------|
| Blueprint | users |
| Auth required | Yes |
| Request body | `name` (string, optional) · `email` (string valid email, optional) — `password` field rejected with `400` |
| Success | `200 { "data": { "id": "...", "name": "...", "email": "..." } }` |
| Errors | `400` — `password` field present; invalid email · `401` — no/invalid JWT · `409` — email already in use |

---

## Backend Folder Structure

```
app/
├── __init__.py               # App factory: create_app(), registers extensions, blueprints, health endpoint, error handlers
├── config.py                 # Config class reading DATABASE_URL, SECRET_KEY, JWT_SECRET_KEY, CORS_ORIGINS from env
├── extensions.py             # Shared extension instances: db, migrate, jwt, cors
├── models/
│   ├── __init__.py           # Re-exports all models so Flask-Migrate can discover them
│   ├── user.py               # User model: id, name, email, password_hash, set_password(), check_password()
│   ├── board.py              # Board model: id, name, owner_id; relationship to BoardMember and Column
│   ├── board_member.py       # BoardMember model: board_id, user_id, role; unique constraint (board_id, user_id)
│   ├── column.py             # Column model: id, board_id, name, order (Float), is_done
│   ├── card.py               # Card model: id, column_id, title, description, priority, order (Float), completed_at, deleted_at
│   ├── comment.py            # Comment model: id, card_id, author_id, content (max 2000)
│   └── notification.py       # Notification model: id, user_id, type, message, is_read, card_id (nullable), board_id (nullable)
├── blueprints/
│   ├── auth/
│   │   ├── routes.py         # POST /api/auth/register, POST /api/auth/login — parses request, calls service, returns JSON
│   │   ├── service.py        # register_user(), login_user() — hashing, JWT creation, duplicate-email check
│   │   └── schema.py         # RegisterSchema, LoginSchema
│   ├── boards/
│   │   ├── routes.py         # CRUD /api/boards, /api/boards/<id>/members — HTTP layer only
│   │   ├── service.py        # create_board(), list_boards(), get_board(), rename_board(), delete_board(),
│   │   │                     # list_members(), add_member(), update_member_role(), remove_member()
│   │   └── schema.py         # BoardSchema, MemberAddSchema, MemberRoleSchema
│   ├── columns/
│   │   ├── routes.py         # POST /api/boards/<id>/columns, PATCH /api/columns/<id>, DELETE, PATCH reorder
│   │   ├── service.py        # create_column(), update_column(), delete_column(), reorder_column()
│   │   │                     # Implements FLOAT order strategy and rebalance logic
│   │   └── schema.py         # ColumnSchema, ColumnReorderSchema
│   ├── cards/
│   │   ├── routes.py         # GET /api/cards, POST /api/columns/<id>/cards, PATCH, DELETE, PATCH position
│   │   ├── service.py        # list_cards(), create_card(), update_card(), soft_delete_card(), move_card()
│   │   │                     # Handles completed_at lifecycle and FLOAT order/rebalance; triggers notifications
│   │   └── schema.py         # CardSchema, CardPositionSchema, CardQuerySchema
│   ├── comments/
│   │   ├── routes.py         # POST/GET /api/cards/<id>/comments, PATCH/DELETE /api/comments/<id>
│   │   ├── service.py        # create_comment(), list_comments(), update_comment(), delete_comment()
│   │   │                     # Triggers comment_added notification
│   │   └── schema.py         # CommentSchema
│   ├── notifications/
│   │   ├── routes.py         # GET /api/notifications, PATCH /api/notifications/<id>/read
│   │   ├── service.py        # list_notifications(), mark_as_read(); create_notification() used by other services
│   │   └── schema.py         # NotificationQuerySchema
│   ├── analytics/
│   │   ├── routes.py         # GET /api/boards/<id>/analytics
│   │   ├── service.py        # get_analytics() — SQLAlchemy joins, no N+1 queries
│   │   └── schema.py         # AnalyticsSchema
│   └── users/
│       ├── routes.py         # GET /api/users/me, PATCH /api/users/me
│       ├── service.py        # get_current_user(), update_user() — rejects password field, checks email uniqueness
│       └── schema.py         # UserSchema (response, no password_hash), UserUpdateSchema
migrations/                   # Flask-Migrate auto-generated migration scripts
tests/
│   ├── conftest.py           # pytest fixtures: app, client, db session, test users, auth headers
│   ├── test_auth.py          # Register and login: success, 400, 409, 401
│   ├── test_boards.py        # Board CRUD and member management: success paths + 400/401/403/404/409
│   ├── test_columns.py       # Column CRUD and reorder: success paths + 400/401/403/404
│   ├── test_cards.py         # Card CRUD, soft-delete, position move: success paths + 400/401/403/404
│   ├── test_comments.py      # Comment CRUD: 201 success, 400 missing content, 401 unauth, 403 not owner
│   ├── test_notifications.py # List and mark-read: success + 400/401/404
│   ├── test_analytics.py     # Analytics: success + 401/403/404
│   └── test_users.py         # Profile get/update: success + 400/401/409
wsgi.py                       # Gunicorn entry point: from app import create_app; app = create_app()
requirements.txt              # All Python dependencies
.env.example                  # Template listing required environment variables (no real values)
```

---

## Frontend Folder Structure (Next.js App Router)

```
app/
├── layout.tsx                # Root layout: wraps children with AuthContextProvider, Header, and react-hot-toast Toaster
├── middleware.ts             # Edge middleware: reads revotask_token cookie; redirects unauthenticated users
│                             # from any route except /login and /register to /login
├── page.tsx                  # Dashboard — Server Component; fetches GET /api/boards server-side via apiClient
├── login/
│   └── page.tsx              # Login form — Client Component; controlled inputs; stores token on success
├── register/
│   └── page.tsx              # Register form — Client Component; client-side validation before API call
├── boards/
│   └── [id]/
│       └── page.tsx          # Board detail — Server Component; fetches GET /api/boards/<id> server-side;
│                             # renders KanbanBoard client island
├── my-tasks/
│   └── page.tsx              # My Tasks — Server Component or Client Component; calls GET /api/cards?assignee=me;
│                             # groups cards by board name; uses BaseBadge for priority
└── profile/
    └── page.tsx              # Profile — Client Component; controlled inputs pre-filled from AuthContext;
                              # sends PATCH /api/users/me; shows success toast

components/
├── shared/
│   ├── BaseButton.tsx        # Button with variant prop: primary | secondary | destructive
│   ├── BaseBadge.tsx         # Badge with color variants for priority: low | medium | high; always includes text
│   └── BaseModal.tsx         # Modal wrapper; closes on Escape; returns focus to trigger element on close
├── board/
│   ├── KanbanBoard.tsx       # Client island: owns drag-and-drop state; renders ColumnList; manages card search
│   ├── ColumnList.tsx        # Renders ordered columns; calls POST /api/boards/<id>/columns for add-column
│   ├── CardItem.tsx          # Draggable card row; drag handle uses useDragAndDrop; opens CardDetailModal on click
│   ├── CardDetailModal.tsx   # Client Component inside BaseModal; editable card fields; "Move to column" select;
│   │                         # calls PATCH /api/cards/<id> and PATCH /api/cards/<id>/position; composes CommentList
│   └── CommentList.tsx       # Renders comments chronologically; shows edit/delete controls to comment author only;
│                             # calls PATCH /api/comments/<id> and DELETE /api/comments/<id>
├── notifications/
│   └── NotificationBell.tsx  # Displays unread count from useNotifications; opens notification list dropdown;
│                             # calls PATCH /api/notifications/<id>/read on click; decrements count
└── Header.tsx                # Client Component: navigation links (/  /my-tasks  /profile),
                              # NotificationBell, logout button (clears cookie + AuthContext, redirects to /login)

hooks/
├── useDragAndDrop.ts         # Native HTML5 Drag and Drop API; on drop calls PATCH /api/cards/<id>/position;
│                             # updates state optimistically; rolls back and shows error toast on API failure
├── useNotifications.ts       # Polls GET /api/notifications every 30 seconds; exposes unread count and
│                             # notification list; used by NotificationBell
└── useErrorHandler.ts        # Accepts ApiError; maps statusCode to toast message; on 401 clears session
│                             # and redirects to /login; on 403 shows "not allowed"; 404 "not found";
│                             # 400 shows validation message; 409 shows conflict message; 5xx generic error

lib/
├── apiClient.ts              # Typed fetch wrapper; reads NEXT_PUBLIC_API_BASE_URL (client) or API_BASE_URL
│                             # (server); attaches Authorization: Bearer <token>; throws ApiError on non-2xx
├── errors.ts                 # ApiError class: statusCode (number), message (string)
├── toast.ts                  # Thin wrappers: success(), error(), loading() over react-hot-toast
└── auth.ts                   # Cookie helpers: getToken(), setToken(token, expires), clearToken()
│                             # used by login page, middleware, and logout action

context/
└── AuthContext.tsx           # React context: holds { user, token }; hydrated from revotask_token cookie on
                              # mount; exposes setAuth() and clearAuth()

types/
└── index.ts                  # TypeScript interfaces: User, Board, BoardMember, Column, Card, Comment,
                              # Notification, ApiError, PaginatedResponse<T>
```

---

## Key Design Decisions

### FLOAT Order Strategy (§5.12)

Cards within a column and columns within a board are ordered by a `db.Float` field named `order`. The assignment strategy is:

- **Append to end:** `order = last.order + 1024`
- **Insert between two items:** `order = (prev.order + next.order) / 2`
- **Insert at top:** `order = first.order / 2`
- **Rebalance:** when the gap between any two neighbouring `order` values drops below `1e-6`, the service renumbers all items in that scope (column's cards or board's columns) to `1024, 2048, 3072, …` in a single database transaction.

The first item in an empty collection always gets `order = 1024`. Rebalancing is triggered inside the service layer immediately after detecting the gap condition, before the transaction commits. `ColumnReorderSchema` and `CardPositionSchema` validate that `order` is a float greater than 0.

### `completed_at` Lifecycle (§5.5)

A `Column` carries a boolean `is_done` flag (default `false`). When `PATCH /api/cards/<id>/position` moves a card:

- Into a column where `is_done = true` → `completed_at` is set to the current UTC timestamp.
- Out of an `is_done = true` column into an `is_done = false` column → `completed_at` is cleared to `null`.

The service layer is responsible for this transition; it checks both the source and destination column's `is_done` values within the same transaction as the position update. Board analytics counts cards completed this week by filtering `completed_at` in the range `[current ISO week Monday 00:00 UTC, now]`.

### JWT Dual-Storage (§5.4)

On successful login the Web stores the JWT in two places:

1. **`revotask_token` cookie** — `SameSite=Lax`, `Secure` in production, expiry equal to the JWT's 24-hour lifetime. Read by `middleware.ts` for route protection and by Server Components via Next.js `cookies()`.
2. **`AuthContext`** — hydrated from the cookie on page load. Used by Client Components and `lib/apiClient` when running in the browser.

Logout is client-side only: `clearToken()` removes the cookie, `clearAuth()` wipes `AuthContext`, then the user is redirected to `/login`. No server-side token revocation endpoint exists (JWTs are stateless; a blocklist is out of scope).

### Soft-Delete for Cards (§5.8)

`DELETE /api/cards/<id>` sets `card.deleted_at` to the current UTC timestamp (soft-delete). Every read query in the service layer filters `WHERE deleted_at IS NULL`. A soft-deleted card is never returned from any read endpoint including `GET /api/boards/<id>`, `GET /api/cards`, or `GET /api/cards/<id>/comments`.

Boards and columns are **hard-deleted** via `DELETE` with cascade to their children. Deleting a column is restricted to admins because it removes all cards in that column.

### Optimistic UI for Card Moves

When a card is dropped onto a new column or position, `useDragAndDrop` immediately updates the local React state to reflect the new position, then calls `PATCH /api/cards/<id>/position`. If the API returns an error response:

1. The local state is restored to the card's pre-drop position.
2. `useErrorHandler` displays an error toast via `lib/toast`.

The `CardDetailModal` "Move to column" select calls the same endpoint, using the same error-handling path, to support card moves on mobile where drag-and-drop is unavailable.

### Authorization Model

- A user who is **not a board member** receives `404` for the board and all its sub-resources (columns, cards, comments, analytics), so the board's existence is not leaked to non-members.
- A board member who **lacks the required role or ownership** receives `403`.
- Authorization checks (membership lookup, role verification, ownership verification) are performed in `service.py`. `routes.py` only parses the HTTP request and formats the response.
- `GET /api/boards/<id>/members` is accessible to any board member because the assignee picker in the card detail form requires it. All write operations on members are admin-only.

### `CardPositionSchema` Validation

`CardPositionSchema` validates:
- `column_id` — must be a valid UUID and must belong to the same board as the card being moved; checked in `service.py` after schema validation.
- `order` — must be a float greater than `0`.

If `column_id` is not a valid UUID, Marshmallow returns `400`. If it is a valid UUID but does not belong to the same board, the service returns `400`.

### Password Hashing

Passwords are stored using Werkzeug's `generate_password_hash` and verified with `check_password_hash`. The minimum password length of 8 characters is enforced by `RegisterSchema` via `validate=validate.Length(min=8)`. The `password_hash` field is never included in any Marshmallow response schema. `UserUpdateSchema` explicitly rejects a `password` field with `400`.

### Response Envelope

Every API response uses the JSON envelope:
- **Success:** `{ "data": ... }`
- **Error:** `{ "error": "<human-readable message>" }`
- **Delete:** `200 { "data": { "id": "<uuid>" } }` — `204` is never used.
- **Pagination:** `{ "data": { "items": [...], "page": <int>, "per_page": <int>, "total": <int> } }` with an additional `unread_count` field for notifications.

Unhandled exceptions in production return a JSON `500` error envelope, never an HTML page or stack trace. The app factory registers a catch-all error handler for this. `debug = False` in production config.

### Notification Triggers

| ID | Event | Recipient | Excluded |
|----|-------|-----------|----------|
| N1 | Card assigned to a user | New assignee | The user who performed the action |
| N2 | Comment added to a card | Card creator + card assignee | The user who added the comment |
| N3 | User added to a board | The added user | — |

Notification creation is handled inside the relevant service functions (`cards/service.py` for N1, `comments/service.py` for N2, `boards/service.py` for N3) by calling `notifications/service.py:create_notification()`.

### Member Access

`GET /api/boards/<id>/members` is open to any board member because the card detail form needs to populate the assignee picker. `POST`, `PATCH`, and `DELETE` on `/api/boards/<id>/members` are restricted to admins. Removing the last remaining admin is rejected with `400`; demoting the last admin via `PATCH` role is also rejected with `400`.

---

## Marshmallow Schemas (key schemas)

```python
# app/blueprints/auth/schema.py
from marshmallow import Schema, fields, validate

class RegisterSchema(Schema):
    name     = fields.String(required=True, validate=validate.Length(min=1, max=100))
    email    = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8), load_only=True)

class LoginSchema(Schema):
    email    = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
```

```python
# app/blueprints/boards/schema.py
from marshmallow import Schema, fields, validate

class BoardSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))

class MemberAddSchema(Schema):
    email = fields.Email(required=True)
    role  = fields.String(required=True, validate=validate.OneOf(["admin", "member"]))

class MemberRoleSchema(Schema):
    role = fields.String(required=True, validate=validate.OneOf(["admin", "member"]))
```

```python
# app/blueprints/columns/schema.py
from marshmallow import Schema, fields, validate

class ColumnSchema(Schema):
    name    = fields.String(required=True, validate=validate.Length(min=1, max=100))
    is_done = fields.Boolean(load_default=False)

class ColumnUpdateSchema(Schema):
    name    = fields.String(validate=validate.Length(min=1, max=100))
    is_done = fields.Boolean()

class ColumnReorderSchema(Schema):
    column_id = fields.UUID(required=True)
    order     = fields.Float(required=True, validate=validate.Range(min=1e-10))
```

```python
# app/blueprints/cards/schema.py
from marshmallow import Schema, fields, validate

class CardSchema(Schema):
    title       = fields.String(required=True, validate=validate.Length(min=1, max=200))
    description = fields.String(validate=validate.Length(max=5000), allow_none=True)
    assignee_id = fields.UUID(allow_none=True)
    due_date    = fields.Date(allow_none=True)
    priority    = fields.String(
        load_default="medium",
        validate=validate.OneOf(["low", "medium", "high"])
    )

class CardUpdateSchema(Schema):
    title       = fields.String(validate=validate.Length(min=1, max=200))
    description = fields.String(validate=validate.Length(max=5000), allow_none=True)
    assignee_id = fields.UUID(allow_none=True)
    due_date    = fields.Date(allow_none=True)
    priority    = fields.String(validate=validate.OneOf(["low", "medium", "high"]))

class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order     = fields.Float(required=True, validate=validate.Range(min=1e-10))

class CardQuerySchema(Schema):
    assignee  = fields.String()
    board_id  = fields.UUID()
    q         = fields.String()
```

```python
# app/blueprints/comments/schema.py
from marshmallow import Schema, fields, validate

class CommentSchema(Schema):
    content = fields.String(required=True, validate=validate.Length(min=1, max=2000))
```

```python
# app/blueprints/notifications/schema.py
from marshmallow import Schema, fields, validate

class NotificationQuerySchema(Schema):
    page     = fields.Integer(load_default=1,  validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
```

```python
# app/blueprints/users/schema.py
from marshmallow import Schema, fields, validate, validates, ValidationError

class UserUpdateSchema(Schema):
    name  = fields.String(validate=validate.Length(min=1, max=100))
    email = fields.Email()

    @validates("password")
    def reject_password(self, value):
        raise ValidationError("Password updates are not allowed via this endpoint.")

    # Declared to trigger the validator if the key is present in the payload
    password = fields.String(load_only=True)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: FLOAT Order Insert Preserves Sort Order

*For any* ordered list of columns or cards and any new item inserted at an arbitrary position, the resulting list sorted by `order` must reflect the intended position (i.e., the new item appears between its intended predecessor and successor).

**Validates: Requirements 6.5, 9.6**

### Property 2: Rebalance Preserves Relative Order

*For any* list of columns or cards that triggers a rebalance (gap < `1e-6`), after renumbering to `1024, 2048, 3072, …` the relative order of all items must be identical to the order before rebalancing.

**Validates: Requirements 6.5, 9.6**

### Property 3: Soft-Delete Exclusion

*For any* board and any read endpoint that returns cards (GET /api/boards/<id>, GET /api/cards, GET /api/cards/<id>/comments), no card with a non-null `deleted_at` must appear in the response.

**Validates: Requirements 8.4, 12.3**

### Property 4: completed_at Round-Trip

*For any* card moved into an `is_done` column and then moved back into a non-`is_done` column, `completed_at` must be `null` after the second move.

**Validates: Requirements 9.4, 9.5**

### Property 5: Notification Self-Exclusion

*For any* triggering event (card assignment, comment addition, board invite), the user who performed the action must not appear in the set of notification recipients.

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 6: Password Never in Response

*For any* API response (register, login, GET /api/users/me, PATCH /api/users/me, any board/member list), the serialised JSON must not contain a `password` or `password_hash` key.

**Validates: Requirements 2.4, 14.1, 18.1**

### Property 7: Non-Member Gets 404, Not 403

*For any* board B and any user U who is not a BoardMember of B, any request to `/api/boards/<B.id>` or its sub-resources must return `404` rather than `403` or `200`.

**Validates: Requirements 5.6, 7.7, 10.8**

### Property 8: Response Envelope Invariant

*For any* API response, the top-level JSON object must contain exactly one of the keys `data` (on success) or `error` (on failure), and never both.

**Validates: Requirements 17.1, 17.2**

---

## Error Handling

### API Error Handling

The app factory registers the following error handlers in `app/__init__.py`:

| Scenario | Handler | Response |
|----------|---------|----------|
| Marshmallow `ValidationError` | `@app.errorhandler(422)` | `400 { "error": "<first validation message>" }` |
| `werkzeug.exceptions.NotFound` | `@app.errorhandler(404)` | `404 { "error": "not found" }` |
| `werkzeug.exceptions.MethodNotAllowed` | `@app.errorhandler(405)` | `405 { "error": "method not allowed" }` |
| `flask_jwt_extended.exceptions.*` | JWT error handlers | `401 { "error": "missing or invalid token" }` |
| Unhandled `Exception` | `@app.errorhandler(Exception)` | `500 { "error": "internal server error" }` — stack trace never exposed; `debug=False` in production |

All service-layer errors are raised as Python exceptions with an HTTP status code attached; `routes.py` catches them and returns the appropriate JSON envelope.

### Web Error Handling

`useErrorHandler` in `hooks/useErrorHandler.ts` is the single point for mapping `ApiError` to user-facing feedback:

| `statusCode` | Action |
|-------------|--------|
| `400` | `lib/toast.error(error.message)` — shows validation message from envelope |
| `401` | `lib/toast.error("session expired")` → clear cookie → clear AuthContext → redirect `/login` |
| `403` | `lib/toast.error("not allowed")` |
| `404` | `lib/toast.error("not found")` |
| `409` | `lib/toast.error(error.message)` — shows conflict message from envelope |
| `500`–`599` | `lib/toast.error("something went wrong, please try again")` |

---

## Testing Strategy

### Backend (pytest)

Each blueprint has a dedicated test file in `tests/`. Tests use a separate PostgreSQL test database (configured via environment variable). `conftest.py` provides fixtures for the Flask test client, a clean database session per test, and pre-built authenticated users.

Coverage per blueprint:

- **Success path** (2xx) for every endpoint.
- **400** validation errors where applicable.
- **401** missing or invalid JWT for every protected endpoint.
- **403** wrong role or ownership for applicable endpoints.
- **404** non-existent or non-member resource for applicable endpoints.
- **409** conflict (duplicate email, duplicate board member) where applicable.

Property-based tests use **Hypothesis** to verify the FLOAT order invariants (Properties 1 and 2) and the soft-delete exclusion (Property 3).

### Frontend (Jest + React Testing Library)

Unit tests for hooks (`useDragAndDrop`, `useNotifications`, `useErrorHandler`) and shared components (`BaseButton`, `BaseBadge`, `BaseModal`). Tests use `role` and `data-testid` selectors. `useErrorHandler` is tested with a mocked API error to verify rollback and toast calls.

### End-to-End (Playwright)

Runs against the live Vercel + Railway deployment. Uses `role` and `data-testid` selectors; no `waitForTimeout`.

**Auth scenarios (4):**
1. Successful login redirects to `/`.
2. Invalid credentials show an error message.
3. Unauthenticated visit to `/` redirects to `/login`.
4. After logout, visiting `/` redirects to `/login`.

**Kanban journey (8 steps):**
1. Log in.
2. Create a board.
3. Add a "To Do" column.
4. Add a "Done" column.
5. Create a card in "To Do".
6. Drag the card to "Done" (using `locator.dragTo()`; wait for `PATCH /api/cards/<id>/position` response with `waitForResponse`).
7. Reload the page.
8. Assert the card is still in "Done".

---

## Traceability Table

| REQ | Requirement Title | Implemented By |
|-----|-------------------|----------------|
| REQ-1 | Health Check | `GET /api/health` (app factory `app/__init__.py`) |
| REQ-2 | User Registration | `POST /api/auth/register` (auth blueprint) + `app/register/page.tsx` |
| REQ-3 | User Login | `POST /api/auth/login` (auth blueprint) + `app/login/page.tsx` + `lib/auth.ts` |
| REQ-4 | Protected Routes and Logout | `app/middleware.ts` + `context/AuthContext.tsx` + `Header.tsx` logout action |
| REQ-5 | Board Management | `POST/GET/PATCH/DELETE /api/boards` (boards blueprint) + `app/page.tsx` (dashboard) |
| REQ-6 | Column Management | `POST /api/boards/<id>/columns`, `PATCH /api/columns/<id>`, `DELETE /api/columns/<id>`, `PATCH /api/boards/<id>/columns/reorder` (columns blueprint) + `components/board/ColumnList.tsx` |
| REQ-7 | Card Creation and Editing | `POST /api/columns/<id>/cards`, `PATCH /api/cards/<id>` (cards blueprint) + `components/board/CardDetailModal.tsx` |
| REQ-8 | Card Soft-Delete | `DELETE /api/cards/<id>` (cards blueprint `service.py` sets `deleted_at`) |
| REQ-9 | Card Move and Position | `PATCH /api/cards/<id>/position` (cards blueprint) + `hooks/useDragAndDrop.ts` + `components/board/CardDetailModal.tsx` "Move to column" select |
| REQ-10 | Comments | `POST/GET /api/cards/<id>/comments`, `PATCH/DELETE /api/comments/<id>` (comments blueprint) + `components/board/CommentList.tsx` |
| REQ-11 | Notifications | `GET /api/notifications`, `PATCH /api/notifications/<id>/read` (notifications blueprint) + `hooks/useNotifications.ts` + `components/notifications/NotificationBell.tsx` |
| REQ-12 | My Tasks | `GET /api/cards?assignee=me` (cards blueprint) + `app/my-tasks/page.tsx` |
| REQ-13 | Card Search | `GET /api/cards?board_id=<uuid>&q=<text>` (cards blueprint) + `components/board/KanbanBoard.tsx` search input (300 ms debounce) |
| REQ-14 | User Profile | `GET/PATCH /api/users/me` (users blueprint) + `app/profile/page.tsx` |
| REQ-15 | Board Analytics | `GET /api/boards/<id>/analytics` (analytics blueprint `service.py` with SQLAlchemy joins) |
| REQ-16 | Member Access Management | `GET/POST/PATCH/DELETE /api/boards/<id>/members` (boards blueprint) |
| REQ-17 | API Response Envelope | All blueprints + app factory error handlers enforce `{ "data": ... }` / `{ "error": "..." }` |
| REQ-18 | Security | `app/config.py` (env vars, CORS), `app/extensions.py` (Flask-JWT-Extended), service layer authorization checks in every blueprint's `service.py` |
| REQ-19 | Performance | `boards/service.py:get_board()` eager-loads columns and cards (SQLAlchemy `joinedload`); `hooks/useDragAndDrop.ts` optimistic update |
| REQ-20 | Responsiveness | Tailwind CSS responsive utilities across all page and component files; `app/boards/[id]/page.tsx` horizontal scroll |
| REQ-21 | Reliability | `hooks/useDragAndDrop.ts` rollback on error; `app/__init__.py` production error handler; `app/config.py` `DEBUG=False` |
| REQ-22 | Maintainability | Blueprint folder structure (`routes.py`/`service.py`/`schema.py`); `components/shared/` reuse; `tsconfig.json` strict mode |
| REQ-23 | Testability | `tests/` pytest suite; `hooks/` Jest tests; Playwright E2E suite (see Testing Strategy) |
| REQ-24 | Accessibility | `components/shared/BaseModal.tsx` Escape key + focus return; `components/shared/BaseBadge.tsx` text + colour; all form inputs in page files have `<label>` elements |
| REQ-25 | Registration Page | `app/register/page.tsx` — controlled inputs, client-side validation (name required, valid email, password ≥ 8 chars), inline error display, calls `POST /api/auth/register` |
| REQ-26 | Dashboard Page | `app/page.tsx` — Next.js Server Component; fetches `GET /api/boards`; renders board list or empty state; create-board action calls `POST /api/boards` |
| REQ-27 | Board Detail Page | `app/boards/[id]/page.tsx` — Server Component; fetches `GET /api/boards/<id>`; `components/board/KanbanBoard.tsx` client island for drag-and-drop, search, add-column, add-card, `CardDetailModal` |
| REQ-28 | Card Detail Modal | `components/board/CardDetailModal.tsx` inside `components/shared/BaseModal.tsx`; editable fields; "Move to column" select; composes `CommentList.tsx`; comment form |
| REQ-29 | Header Component | `components/Header.tsx` — navigation links, `NotificationBell.tsx`, logout; `hooks/useNotifications.ts` feeds bell count |
| REQ-30 | useErrorHandler Hook | `hooks/useErrorHandler.ts` |
| REQ-31 | lib/apiClient Module | `lib/apiClient.ts` + `lib/errors.ts` + `lib/toast.ts` |
| REQ-32 | Shared UI Components | `components/shared/BaseButton.tsx`, `components/shared/BaseBadge.tsx`, `components/shared/BaseModal.tsx` |
