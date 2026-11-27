# Implementation Plan: RevoTask MVP

## Overview

This plan builds the RevoTask MVP in incremental layers: backend skeleton → health endpoint → API deploy (Vercel + Neon) → each Flask blueprint (implementation + tests) → frontend skeleton → pages and feature components → Vercel deploy → Playwright E2E. Each step produces working, tested code before the next begins.

## Tasks

- [ ] 0. Steering guidelines (before any code task)
  - [ ] 0.1 Author the steering guidelines
    - Create `guidelines/backend.md`, `guidelines/database.md` and `guidelines/frontend.md`; every guideline has a Rule, a Rationale and a concrete RevoTask Example; no rule overlaps or contradicts a rule in another file
    - Load the guidelines as project instructions for the AI coding tool before generating any code, and keep one before/after comparison of AI output generated without and with the guidelines
    - _Requirements: REQ-22.1–22.3_

- [ ] 1. Backend project skeleton
  - [ ] 1.1 Scaffold `backend/` folder structure and core files
    - Create `backend/app/__init__.py` with the `create_app()` application factory; register extensions, blueprints, error handlers, and the health endpoint placeholder
    - Create `backend/app/config.py` with the `Config` class; normalise `DATABASE_URL` by replacing a leading `"postgres://"` with `"postgresql://"` (some hosts issue the short scheme); read `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `FLASK_ENV` from environment; set `JWT_ACCESS_TOKEN_EXPIRES` to 24 hours; set `debug = False` for production
    - Create `backend/app/extensions.py` with shared extension instances: `db` (Flask-SQLAlchemy), `migrate` (Flask-Migrate), `jwt` (Flask-JWT-Extended), `cors` (Flask-CORS)
    - Configure Flask-CORS in `create_app()` with `origins` read from `CORS_ORIGINS` (comma-separated list), applied to `/api/*`
    - Create `backend/app/exceptions.py` with `AppError(Exception)` holding `status_code: int` and `message: str`; register a single `@app.errorhandler(AppError)` in the factory that returns `{ "error": message }` with `status_code`
    - Register JWT loaders in the factory: `@jwt.unauthorized_loader`, `@jwt.invalid_token_loader`, and `@jwt.expired_token_loader` all return `401 { "error": "missing or invalid token" }`
    - Register `@app.errorhandler(ValidationError)` returning `400 { "error": "<first message>" }`, `@app.errorhandler(NotFound)` returning `404 { "error": "not found" }`, `@app.errorhandler(HTTPException)` returning `e.code { "error": e.description }`, and catch-all `@app.errorhandler(Exception)` returning `500 { "error": "internal server error" }` with no stack trace
    - Create `backend/wsgi.py` as the WSGI entry point that Vercel detects: `from app import create_app; app = create_app()`
    - Create `backend/requirements.txt` listing: Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, Flask-CORS, marshmallow, Werkzeug, psycopg2-binary, pytest, pytest-flask, python-dotenv
    - Create `backend/.env.example` listing all required env vars (`DATABASE_URL`, `TEST_DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `FLASK_ENV`) with placeholder values and no real secrets
    - Create empty `backend/app/blueprints/` package directory tree (one `__init__.py` per blueprint folder: auth, boards, columns, cards, comments, notifications, analytics, users)
    - _Requirements: REQ-4.2, REQ-17.1–17.5, REQ-18.3, REQ-18.5, REQ-18.6, REQ-21.2, REQ-21.3, REQ-22.1_

  - [ ] 1.2 Create all Flask-SQLAlchemy models
    - Create `backend/app/models/__init__.py` that re-exports all models so Flask-Migrate can discover them
    - Create `backend/app/models/user.py`: `User` model with `id` (UUID PK), `name` (String 100), `email` (String 255, unique), `password_hash` (String 255), timezone-aware `created_at`/`updated_at` using `db.DateTime(timezone=True)` and `default=lambda: datetime.now(timezone.utc)`; add `set_password()` and `check_password()` using Werkzeug; define all relationships: `board_memberships`, `created_cards`, `assigned_cards`, `comments`, `notifications`
    - Create `backend/app/models/board.py`: `Board` model with `id`, `name` (String 100), `owner_id` (FK `users.id`); relationships to `BoardMember` and `BoardColumn`
    - Create `backend/app/models/board_member.py`: `BoardMember` model with `id`, `board_id` (FK), `user_id` (FK, `index=True`), `role` (String 10); `UniqueConstraint("board_id", "user_id", name="uq_board_member")`
    - Create `backend/app/models/column.py`: class name `BoardColumn` with `__tablename__ = "columns"`; fields: `id`, `board_id` (FK, `index=True`), `name` (String 100), `order` (Float), `is_done` (Boolean, default False); relationship to `Card` using `order_by="Card.order"`
    - Create `backend/app/models/card.py`: `Card` model with `id`, `column_id` (FK, `index=True`), `title` (String 200), `description` (String 5000, nullable), `assignee_id` (FK `users.id`, nullable, `index=True`), `created_by` (FK `users.id`), `due_date` (Date, nullable), `priority` (String 10, default `"medium"`), `order` (Float), `completed_at` (DateTime timezone=True, nullable), `deleted_at` (DateTime timezone=True, nullable)
    - Create `backend/app/models/comment.py`: `Comment` model with `id`, `card_id` (FK, `index=True`), `author_id` (FK `users.id`), `content` (String 2000), timezone-aware timestamps
    - Create `backend/app/models/notification.py`: `Notification` model with `id`, `user_id` (FK, `index=True`), `type` (String 20), `message` (String 500), `is_read` (Boolean, default False), `card_id` (FK `cards.id`, `ondelete="SET NULL"`, nullable), `board_id` (FK `boards.id`, `ondelete="SET NULL"`, nullable), timezone-aware timestamps
    - Initialise Flask-Migrate: run `flask db init` to create the `backend/migrations/` directory; generate the initial migration with `flask db migrate`
    - _Requirements: REQ-5.3, REQ-6.5, REQ-9.4, REQ-9.6, REQ-18.4_

- [ ] 2. Health endpoint and pytest setup
  - [ ] 2.1 Implement `GET /api/health` in the app factory
    - Add the health route inside `create_app()` in `backend/app/__init__.py`; execute a trivial DB query (`db.session.execute(text("SELECT 1"))`); return `200 { "data": { "status": "ok" } }` on success and `503 { "error": "database unavailable" }` if the DB is unreachable
    - Create `backend/tests/conftest.py` with pytest fixtures: `app` (test Flask app using a separate PostgreSQL database from `TEST_DATABASE_URL` — never in-memory SQLite, which drops timezone info on `DateTime(timezone=True)` and does not enforce `ondelete="SET NULL"`), `client` (Flask test client), `db_session` (clean database session per test), `test_user` and `test_user_2` (pre-created User rows), `auth_headers` (helper returning `Authorization: Bearer <jwt>` for a given user)
    - Create `backend/tests/test_health.py` with tests: `GET /api/health` returns `200 { "data": { "status": "ok" } }`
    - _Requirements: REQ-1.1, REQ-1.2, REQ-1.3_

- [ ] 3. API deploy (Vercel + Neon)
  - [ ] 3.1 Create the Vercel configuration and run the initial migration
    - Create `backend/vercel.json` with a build command that runs `flask db upgrade`, and `backend/.python-version`; no `Procfile` is needed, because Vercel detects the Flask `app` exported by `backend/wsgi.py`
    - Document the one-time setup steps as comments in `.env.example`: create a Neon project, copy its pooled connection string into `DATABASE_URL`, set `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `FLASK_ENV=production` as Vercel environment variables
    - Run `flask db upgrade` as the Vercel build command so the schema is applied before the new version serves its first request
    - Verify `GET /api/health` returns `200` on the live API URL
    - _Requirements: REQ-1.1, REQ-18.6_

- [ ] 4. Auth blueprint
  - [ ] 4.1 Implement auth routes, service, and schemas
    - Create `backend/app/blueprints/auth/schema.py`: `RegisterSchema` (name String 1–100, email Email, password String min 8 load_only); `LoginSchema` (email Email, password String load_only)
    - Create `backend/app/blueprints/auth/service.py`: `register_user(data)` — check for duplicate email (raise `AppError(409, ...)`), create User with `set_password()`, commit, return user; `login_user(data)` — look up by email, call `check_password()` (raise `AppError(401, ...)` on mismatch), create JWT with `create_access_token`, return token and user
    - Create `backend/app/blueprints/auth/routes.py`: `POST /api/auth/register` → validate with `RegisterSchema`, call `register_user`, return `201 { "data": UserOut }`; `POST /api/auth/login` → validate with `LoginSchema`, call `login_user`, return `200 { "data": { "access_token": ..., "user": UserOut } }`; no `try/except` in routes — errors propagate to app-factory handlers
    - Register the auth Blueprint in `create_app()`
    - Add `UserOut` dump schema to `backend/app/blueprints/users/schema.py` (or a shared location) for use across blueprints
    - _Requirements: REQ-2.1–2.4, REQ-2.6, REQ-3.1–3.2, REQ-18.1, REQ-18.2_

  - [ ] 4.2 Write pytest tests for the auth blueprint
    - In `backend/tests/test_auth.py` write the following test cases:
      - `POST /api/auth/register` with valid data returns `201` and a user body containing `id`, `name`, `email` (no `password_hash`)
      - `POST /api/auth/register` with a duplicate email returns `409`
      - `POST /api/auth/register` missing `email` or `password` returns `400`
      - `POST /api/auth/register` with a password shorter than 8 characters returns `400`
      - `POST /api/auth/login` with valid credentials returns `200` with `access_token` and `user`
      - `POST /api/auth/login` with wrong password returns `401`
      - `POST /api/auth/login` missing fields returns `400`
    - _Requirements: REQ-2.1–2.4, REQ-2.6, REQ-3.1–3.2_

- [ ] 5. Boards blueprint
  - [ ] 5.1 Implement boards routes, service, and schemas
    - Create `backend/app/blueprints/boards/schema.py`: `BoardSchema` (name String 1–100); `MemberAddSchema` (email Email, role OneOf `["admin","member"]`); `MemberRoleSchema` (role OneOf `["admin","member"]`); dump schemas `BoardOut` (id, name, role, created_at), `MemberOut` (user_id, name, email, role)
    - Create `backend/app/blueprints/boards/service.py`: `create_board(user_id, data)` — create Board, add creator as BoardMember with `role="admin"`, return board; `list_boards(user_id)` — query boards via BoardMember join, include the requesting user's role; `get_board(user_id, board_id)` — membership check (raise `AppError(404, ...)` if not member), use `selectinload(Board.columns).selectinload(BoardColumn.cards.and_(Card.deleted_at.is_(None)))` ordered by `BoardColumn.order` and `Card.order`; `rename_board(user_id, board_id, data)` — admin check (raise `AppError(403, ...)`), update name; `delete_board(user_id, board_id)` — admin check, hard-delete; `list_members(user_id, board_id)`; `add_member(user_id, board_id, data)` — admin check, look up email (raise `AppError(404, ...)` if not found), check for duplicate (raise `AppError(409, ...)`), create BoardMember, trigger `create_notification` (N3); `update_member_role(user_id, board_id, target_user_id, data)` — admin check, last-admin-demotion guard (raise `AppError(400, ...)`); `remove_member(user_id, board_id, target_user_id)` — admin check, last-admin-removal guard (raise `AppError(400, ...)`)
    - Create `backend/app/blueprints/boards/routes.py`: implement all board and member endpoints listed in design.md; no `try/except`; use `@jwt_required()` for protected routes
    - Register the boards Blueprint in `create_app()`
    - _Requirements: REQ-5.1–5.7, REQ-16.1–16.10, REQ-18.4, REQ-19.2_

  - [ ] 5.2 Write pytest tests for the boards blueprint
    - In `backend/tests/test_boards.py` write the following test cases:
      - `POST /api/boards` creates a board and auto-assigns creator as admin → `201`
      - `POST /api/boards` missing name → `400`
      - `GET /api/boards` returns only boards the user belongs to → `200`
      - `GET /api/boards` with no JWT → `401`
      - `GET /api/boards/<id>` as a member returns board with ordered columns and non-deleted cards → `200`; verify `selectinload` is used (no extra queries)
      - `GET /api/boards/<id>` by a non-member → `404`
      - `PATCH /api/boards/<id>` as admin renames board → `200`
      - `PATCH /api/boards/<id>` as member → `403`
      - `DELETE /api/boards/<id>` as admin → `200`; board and columns hard-deleted
      - `DELETE /api/boards/<id>` as member → `403`
      - `GET /api/boards/<id>/members` as member → `200`
      - `POST /api/boards/<id>/members` as admin with valid email → `201`; board_invite notification created
      - `POST /api/boards/<id>/members` with unregistered email → `404`
      - `POST /api/boards/<id>/members` with duplicate member → `409`
      - `POST /api/boards/<id>/members` with invalid role → `400`
      - `POST /api/boards/<id>/members` as member → `403`
      - `PATCH /api/boards/<id>/members/<user_id>` demote last admin → `400`
      - `DELETE /api/boards/<id>/members/<user_id>` remove last admin → `400`
    - _Requirements: REQ-5.1–5.7, REQ-16.1–16.10_

- [ ] 6. Columns blueprint
  - [ ] 6.1 Implement columns routes, service, and schemas
    - Create `backend/app/blueprints/columns/schema.py`: `ColumnSchema` (name String 1–100, is_done Boolean default False); `ColumnUpdateSchema` (name optional, is_done optional); `ColumnReorderSchema` (column_id UUID required, order Float `validate.Range(min=0, min_inclusive=False)` required); dump schema `ColumnOut` (id, board_id, name, order, is_done)
    - Create `backend/app/blueprints/columns/service.py`: `create_column(user_id, board_id, data)` — membership check, calculate FLOAT order (1024 for first; last + 1024 otherwise), create column; `update_column(user_id, column_id, data)` — membership check, apply name/is_done; `delete_column(user_id, column_id)` — membership check, admin check (raise `AppError(403, ...)`), hard-delete column and all its cards; `reorder_column(user_id, board_id, data)` — membership check, validate `column_id` belongs to this board (raise `AppError(400, ...)` otherwise), update order; apply FLOAT rebalance if gap < `1e-6` (renumber all columns in board to `1024, 2048, 3072, …` in one transaction); return `ColumnOut` plus `rebalanced` bool and `column_orders` list when rebalanced
    - Create `backend/app/blueprints/columns/routes.py`: `POST /api/boards/<id>/columns`, `PATCH /api/columns/<id>`, `DELETE /api/columns/<id>`, `PATCH /api/boards/<id>/columns/reorder`; no `try/except`
    - Register the columns Blueprint in `create_app()`
    - _Requirements: REQ-6.1–6.9_

  - [ ] 6.2 Write pytest tests for the columns blueprint (includes FLOAT order property tests)
    - In `backend/tests/test_columns.py` write the following test cases:
      - `POST /api/boards/<id>/columns` as member creates column with `order = 1024` → `201`
      - `POST /api/boards/<id>/columns` second column gets `order = 2048` → `201`
      - `POST /api/boards/<id>/columns` missing name → `400`
      - `POST /api/boards/<id>/columns` no JWT → `401`
      - `POST /api/boards/<id>/columns` user not a board member → `404`
      - `PATCH /api/columns/<id>` rename and toggle `is_done` → `200`
      - `PATCH /api/columns/<id>` no valid fields → `400`
      - `DELETE /api/columns/<id>` as admin hard-deletes column → `200`
      - `DELETE /api/columns/<id>` as member → `403`
      - `PATCH /api/boards/<id>/columns/reorder` with invalid `column_id` (not on board) → `400`
      - `PATCH /api/boards/<id>/columns/reorder` with `order = 0` → `400`
      - **Property 1 (parametrised):** for inserts at top, end, and between two columns, verify that sorting by `order` reflects the intended position — _validates REQ-6.5_
      - **Property 2 (parametrised):** force a rebalance scenario (gap < 1e-6), verify that relative order of all columns is preserved after renumbering to `1024, 2048, …` — _validates REQ-6.5_
    - _Requirements: REQ-6.1–6.9_

- [ ] 7. Cards blueprint
  - [ ] 7.1 Implement cards routes, service, and schemas
    - Create `backend/app/blueprints/cards/schema.py`: `CardSchema` (title String 1–200 required, description String ≤5000 optional, assignee_id UUID optional, due_date Date optional, priority OneOf `["low","medium","high"]` default `"medium"`); `CardUpdateSchema` (all fields optional); `CardPositionSchema` (column_id UUID required, order Float `validate.Range(min=0, min_inclusive=False)` required); `CardQuerySchema` (assignee OneOf `["me"]` optional, board_id UUID optional, q String optional); dump schemas `CardOut` (id, column_id, board_id, board_name, title, description, priority, due_date, order, completed_at, created_by, assignee nested AssigneeOut); `AssigneeOut` (id, name)
    - Create `backend/app/blueprints/cards/service.py`: `list_cards(user_id, params)` — raise `AppError(400, "assignee or board_id is required")` if neither `assignee` nor `board_id` is provided; filter `deleted_at IS NULL`; support `assignee=me`, `board_id`, and `q` (ILIKE on title); check board membership for `board_id` (raise `AppError(404, ...)`); include `board_id` and `board_name` in `CardOut`; `create_card(user_id, column_id, data)` — membership check, validate `assignee_id` is a board member (raise `AppError(400, ...)`), calculate FLOAT order, set `created_by`, trigger N1 notification if `assignee_id` provided and not self; `update_card(user_id, card_id, data)` — membership check, validate fields, trigger N1 notification on assignee change; `soft_delete_card(user_id, card_id)` — membership check, ownership-or-admin check (raise `AppError(403, ...)`), set `deleted_at`; `move_card(user_id, card_id, data)` — membership check, validate `column_id` on same board (raise `AppError(400, ...)`), update `column_id` and `order`, apply FLOAT rebalance if needed, handle `completed_at` lifecycle (set on move to `is_done=true` column; clear on move to `is_done=false` column); no notification on a move (N1 is created only when `assignee_id` is set or changed — REQ-11.1); return `CardOut` plus `rebalanced` and `column_orders`
    - Create `backend/app/blueprints/cards/routes.py`: `GET /api/cards`, `POST /api/columns/<id>/cards`, `PATCH /api/cards/<id>`, `DELETE /api/cards/<id>`, `PATCH /api/cards/<id>/position`; no `try/except`
    - Register the cards Blueprint in `create_app()`
    - _Requirements: REQ-7.1–7.7, REQ-8.1–8.4, REQ-9.1–9.6, REQ-9.11, REQ-12.1–12.3, REQ-13.1, REQ-13.3_

  - [ ] 7.2 Write pytest tests for the cards blueprint (includes FLOAT order and soft-delete property tests)
    - In `backend/tests/test_cards.py` write the following test cases:
      - `POST /api/columns/<id>/cards` with title → `201`; `created_by` matches requester; `order = 1024`
      - `POST /api/columns/<id>/cards` missing title → `400`
      - `POST /api/columns/<id>/cards` title > 200 chars → `400`
      - `POST /api/columns/<id>/cards` description > 5000 chars → `400`
      - `POST /api/columns/<id>/cards` invalid priority → `400`
      - `POST /api/columns/<id>/cards` with `assignee_id` not a board member → `400`
      - `POST /api/columns/<id>/cards` no JWT → `401`
      - `POST /api/columns/<id>/cards` non-member → `404`
      - `PATCH /api/cards/<id>` updates fields → `200`
      - `DELETE /api/cards/<id>` by creator → `200`; `deleted_at` is set
      - `DELETE /api/cards/<id>` by non-creator member → `403`
      - `DELETE /api/cards/<id>` by admin who is not creator → `200`
      - `GET /api/cards?assignee=me` returns only non-deleted cards for requester → `200`
      - `GET /api/cards?board_id=<id>&q=<text>` returns ILIKE-matched cards → `200`
      - `GET /api/cards` with neither `assignee` nor `board_id` → `400`
      - `GET /api/cards?board_id=<id>` user not a member of that board → `404`
      - `PATCH /api/cards/<id>/position` valid move → `200`; `column_id` updated
      - `PATCH /api/cards/<id>/position` `column_id` not on same board → `400`
      - `PATCH /api/cards/<id>/position` `order = 0` → `400`
      - `PATCH /api/cards/<id>/position` column_id not a valid UUID → `400`
      - `PATCH /api/cards/<id>/position` move to `is_done=true` column sets `completed_at` → `200`
      - `PATCH /api/cards/<id>/position` move back to `is_done=false` clears `completed_at` → `200`
      - **Property 3 (parametrised):** create and soft-delete a card; verify it never appears in `GET /api/boards/<id>`, `GET /api/cards`, or `GET /api/cards/<id>/comments` — _validates REQ-8.4, REQ-12.3_
      - **Property 1 (cards, parametrised):** insert at top, end, and between two cards; verify sort by `order` reflects intended position — _validates REQ-9.6_
      - **Property 2 (cards, parametrised):** force rebalance scenario; verify relative order preserved — _validates REQ-9.6_
      - **Property 4 (parametrised):** move card to `is_done` column then back; verify `completed_at` is `null` after second move — _validates REQ-9.4, REQ-9.5_
    - _Requirements: REQ-7.1–7.7, REQ-8.1–8.4, REQ-9.1–9.6, REQ-9.11, REQ-12.1–12.3_

- [ ] 8. Comments blueprint
  - [ ] 8.1 Implement comments routes, service, and schemas
    - Create `backend/app/blueprints/comments/schema.py`: `CommentSchema` (content String 1–2000 required); dump schemas `CommentOut` (id, card_id, content, created_at, updated_at, author nested AuthorOut); `AuthorOut` (id, name)
    - Create `backend/app/blueprints/comments/service.py`: `create_comment(user_id, card_id, data)` — membership check, card existence and soft-delete check (raise `AppError(404, ...)`), create Comment, trigger N2 notification for card creator and assignee excluding the commenter; `list_comments(user_id, card_id)` — membership check, soft-delete check, return comments in chronological order with nested author; `update_comment(user_id, comment_id, data)` — author check (raise `AppError(403, ...)`), update content; `delete_comment(user_id, comment_id)` — author check (raise `AppError(403, ...)`), delete comment; every function validates membership (raise `AppError(404, ...)` for non-members)
    - Create `backend/app/blueprints/comments/routes.py`: `POST /api/cards/<id>/comments`, `GET /api/cards/<id>/comments`, `PATCH /api/comments/<id>`, `DELETE /api/comments/<id>`; no `try/except`
    - Register the comments Blueprint in `create_app()`
    - _Requirements: REQ-10.1–10.8_

  - [ ] 8.2 Write pytest tests for the comments blueprint
    - In `backend/tests/test_comments.py` write the following test cases:
      - `POST /api/cards/<id>/comments` with valid content → `201`; response includes nested `author { id, name }`
      - `POST /api/cards/<id>/comments` missing content → `400`
      - `POST /api/cards/<id>/comments` content > 2000 chars → `400`
      - `POST /api/cards/<id>/comments` no JWT → `401`
      - `POST /api/cards/<id>/comments` user not a board member → `404`
      - `POST /api/cards/<id>/comments` on a soft-deleted card → `404`
      - `GET /api/cards/<id>/comments` returns comments in chronological order → `200`
      - `GET /api/cards/<id>/comments` on soft-deleted card → `404`
      - `PATCH /api/comments/<id>` by author updates content → `200`
      - `PATCH /api/comments/<id>` by non-author → `403`
      - `DELETE /api/comments/<id>` by author → `200`
      - `DELETE /api/comments/<id>` by non-author member → `403`
      - Posting a comment creates N2 notifications for card creator and assignee but not the commenter — _validates Property 5_
    - _Requirements: REQ-10.1–10.8_

- [ ] 9. Notifications blueprint
  - [ ] 9.1 Implement notifications routes, service, and schemas
    - Create `backend/app/blueprints/notifications/schema.py`: `NotificationQuerySchema` (page Integer ≥1 default 1, per_page Integer 1–100 default 20); dump schema `NotificationOut` (id, type, message, is_read, card_id nullable, board_id nullable, created_at)
    - Create `backend/app/blueprints/notifications/service.py`: `create_notification(user_id, type, message, card_id=None, board_id=None)` — used by cards, comments, and boards services; `list_notifications(user_id, params)` — paginate in reverse chronological order, include `unread_count`; `mark_as_read(user_id, notification_id)` — ownership check (raise `AppError(404, ...)` if notification belongs to different user), set `is_read = True`
    - Create `backend/app/blueprints/notifications/routes.py`: `GET /api/notifications`, `PATCH /api/notifications/<id>/read`; no `try/except`
    - Register the notifications Blueprint in `create_app()`
    - _Requirements: REQ-11.1–11.10_

  - [ ] 9.2 Write pytest tests for the notifications blueprint
    - In `backend/tests/test_notifications.py` write the following test cases:
      - `GET /api/notifications` returns paginated notifications in reverse chronological order with `unread_count` → `200`
      - `GET /api/notifications?page=0` → `400`
      - `GET /api/notifications?per_page=101` → `400`
      - `GET /api/notifications` no JWT → `401`
      - `PATCH /api/notifications/<id>/read` marks as read → `200` with `is_read: true`
      - `PATCH /api/notifications/<id>/read` for a different user's notification → `404`
      - `PATCH /api/notifications/<id>/read` no JWT → `401`
      - **Property 5 (parametrised):** for each notification type (card_assigned, comment_added, board_invite), the user who performed the action is not among the notification recipients — _validates REQ-11.1–11.3_
    - _Requirements: REQ-11.1–11.10_

- [ ] 10. Analytics blueprint
  - [ ] 10.1 Implement analytics routes, service, and schemas
    - Create `backend/app/blueprints/analytics/schema.py`: dump schema for the analytics response (cards_per_column array, completed_this_week int, member_activity array with user_id, name, cards_created, cards_assigned, comments_last_7_days)
    - Create `backend/app/blueprints/analytics/service.py`: `get_analytics(user_id, board_id)` — membership check, admin check (raise `AppError(403, ...)`), compute all three metrics using SQLAlchemy joins with no N+1 queries; `completed_this_week` filters `completed_at` in `[ISO-week Monday 00:00 UTC, now]`; comments in last 7 days uses a date filter on `comments.created_at`
    - Create `backend/app/blueprints/analytics/routes.py`: `GET /api/boards/<id>/analytics`; no `try/except`
    - Register the analytics Blueprint in `create_app()`
    - _Requirements: REQ-15.1–15.5_

  - [ ] 10.2 Write pytest tests for the analytics blueprint
    - In `backend/tests/test_analytics.py` write the following test cases:
      - `GET /api/boards/<id>/analytics` as admin returns cards_per_column, completed_this_week, and member_activity → `200`
      - Soft-deleted cards are not counted in `cards_per_column`
      - `GET /api/boards/<id>/analytics` as member → `403`
      - `GET /api/boards/<id>/analytics` no JWT → `401`
      - `GET /api/boards/<id>/analytics` for a board the user is not a member of → `404`
    - _Requirements: REQ-15.1–15.5_

- [ ] 11. Users blueprint
  - [ ] 11.1 Implement users routes, service, and schemas
    - Create `backend/app/blueprints/users/schema.py`: dump schema `UserOut` (id, name, email — never password_hash); `UserUpdateSchema` (name String 1–100 optional, email Email optional, password String load_only with `@validates("password")` raising `ValidationError` to return 400)
    - Create `backend/app/blueprints/users/service.py`: `get_current_user(user_id)` — return User; `update_user(user_id, data)` — check email uniqueness (raise `AppError(409, ...)`), apply name/email
    - Create `backend/app/blueprints/users/routes.py`: `GET /api/users/me`, `PATCH /api/users/me`; no `try/except`
    - Register the users Blueprint in `create_app()`
    - **Property 6:** `UserOut` schema must not include `password` or `password_hash`; verify by asserting the dump schema fields list excludes both keys
    - _Requirements: REQ-14.1–14.2, REQ-14.3, REQ-14.5, REQ-18.4_

  - [ ] 11.2 Write pytest tests for the users blueprint
    - In `backend/tests/test_users.py` write the following test cases:
      - `GET /api/users/me` returns `{ id, name, email }` with no `password_hash` → `200`
      - `GET /api/users/me` no JWT → `401`
      - `PATCH /api/users/me` with new name and email → `200`
      - `PATCH /api/users/me` with email already in use → `409`
      - `PATCH /api/users/me` with `password` field → `400`
      - `PATCH /api/users/me` with invalid email format → `400`
      - `PATCH /api/users/me` no JWT → `401`
      - **Property 6:** assert `password` and `password_hash` keys are absent from every response body in this test file — _validates REQ-14.1, REQ-2.4_
    - _Requirements: REQ-14.1–14.5_

- [ ] 12. Backend checkpoint — Ensure all tests pass
  - Run `pytest backend/tests/` and confirm all tests pass; resolve any failures before proceeding to the frontend.
  - _Requirements: REQ-23.1_

- [ ] 13. Frontend project skeleton
  - [ ] 13.1 Bootstrap Next.js project and configure TypeScript, Tailwind, and environment
    - Initialise a Next.js App Router project in `frontend/` using `create-next-app` with TypeScript enabled; set `"strict": true` and `"noImplicitAny": true` in `frontend/tsconfig.json`; install and configure Tailwind CSS
    - Create `frontend/.env.example` listing `NEXT_PUBLIC_API_BASE_URL` (used by Client Components) and `API_BASE_URL` (used by Server Components) with placeholder values
    - Install dependencies: `react-hot-toast` plus the test tooling. No drag-and-drop library: drag-and-drop uses only the native HTML5 Drag and Drop API (REQ-9.9)
    - Install and configure Jest + React Testing Library: `jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` and TypeScript support via `next/jest`; create `frontend/jest.config.ts` and `frontend/jest.setup.ts`; add `"test": "jest"` to `frontend/package.json` so `npm test` runs the suite
    - _Requirements: REQ-22.3, REQ-31.1–31.2_

  - [ ] 13.2 Create TypeScript types
    - Create `frontend/types/index.ts` with interfaces: `User`, `Board`, `BoardMember`, `Column`, `Card`, `Comment`, `Notification`, `ApiError`, `PaginatedResponse<T>`; ensure all fields match the API response schemas in design.md
    - _Requirements: REQ-22.3_

  - [ ] 13.3 Create lib/ modules
    - Create `frontend/lib/errors.ts`: `ApiError` class with `statusCode: number` and `message: string`
    - Create `frontend/lib/apiClient.ts`: typed fetch wrapper; reads `NEXT_PUBLIC_API_BASE_URL` in Client Components and `API_BASE_URL` in Server Components; takes the token as an explicit argument and attaches `Authorization: Bearer <token>` when one is given; imports nothing server-only, so it is safe in both Client and Server Components; throws `ApiError` on any non-2xx response by extracting `statusCode` from HTTP status and `message` from `{ "error": "..." }` envelope
    - Create `frontend/lib/toast.ts`: thin wrappers `success()`, `error()`, `loading()` over `react-hot-toast`
    - Create `frontend/lib/auth.ts` (client-only): cookie helpers `getToken()`, `setToken(token, expires)`, `clearToken()` using `document.cookie`; expiry equals JWT 24-hour lifetime; must never import `next/headers` (server-only — would break the client build). Server Components read the cookie themselves with `cookies()` from `next/headers` and pass the token to `apiClient`
    - _Requirements: REQ-31.1–31.5_

  - [ ] 13.4 Create AuthContext
    - Create `frontend/context/AuthContext.tsx`: React context holding `{ user: User | null, token: string | null }`; hydrate from `revotask_token` cookie on mount; expose `setAuth(user, token)` and `clearAuth()` for use by login page and logout action
    - _Requirements: REQ-3.3, REQ-3.5, REQ-4.3_

  - [ ] 13.5 Create shared UI components
    - Create `frontend/components/shared/BaseButton.tsx`: accept a `variant` prop with values `primary`, `secondary`, `destructive`; render distinct Tailwind classes per variant; ensure minimum 44×44 px tap targets via `min-w-[44px] min-h-[44px]`
    - Create `frontend/components/shared/BaseBadge.tsx`: accept a `priority` prop (`low` | `medium` | `high`); render a colour badge that always includes the priority text so the information is not colour-only
    - Create `frontend/components/shared/BaseModal.tsx`: modal wrapper that closes on Escape key press; returns focus to the trigger element on close; traps focus within the modal while open
    - _Requirements: REQ-22.2, REQ-24.2, REQ-24.3, REQ-32.1–32.2_

  - [ ] 13.6 Write component tests for the shared UI components
    - In `frontend/__tests__/BaseButton.test.tsx`: each of the three variants (`primary`, `secondary`, `destructive`) renders its own style and fires `onClick`
    - In `frontend/__tests__/BaseBadge.test.tsx`: the priority text is always rendered for `low`, `medium` and `high`
    - In `frontend/__tests__/BaseModal.test.tsx`: pressing Escape closes the modal and focus returns to the trigger element
    - Use `role` and label queries from React Testing Library
    - _Requirements: REQ-24.2, REQ-24.3, REQ-32.1–32.2_

- [ ] 14. Frontend hooks and middleware
  - [ ] 14.1 Create useErrorHandler hook
    - Create `frontend/hooks/useErrorHandler.ts`: accept an `ApiError`; map `statusCode` to actions: `400` → `lib/toast.error(error.message)`; `401` → toast "session expired", clear cookie, `clearAuth()`, redirect `/login`; `403` → toast "not allowed"; `404` → toast "not found"; `409` → `lib/toast.error(error.message)`; `500–599` → toast "something went wrong, please try again"
    - Write Jest unit tests in `frontend/__tests__/useErrorHandler.test.ts`: verify each status code maps to the correct toast message; verify `401` clears cookie and redirects
    - _Requirements: REQ-30.1–30.7_

  - [ ] 14.2 Create useNotifications hook
    - Create `frontend/hooks/useNotifications.ts`: poll `GET /api/notifications` every 30 seconds using `setInterval`; expose `unreadCount`, `notifications` list, and a `markRead(id)` function; clear the interval on unmount
    - Write Jest unit tests in `frontend/__tests__/useNotifications.test.ts`: mock `apiClient`, assert poll is called at 30-second intervals; assert `unreadCount` is updated correctly
    - _Requirements: REQ-11.7, REQ-29.2_

  - [ ] 14.3 Create useDragAndDrop hook
    - Create `frontend/hooks/useDragAndDrop.ts`: implement using the native HTML5 Drag and Drop API; on drop, optimistically update local card position state before the API call; call `PATCH /api/cards/<id>/position`; on success apply `column_orders` to local state if `rebalanced` is true; on failure restore the card's original position and call `useErrorHandler` to show an error toast
    - Write Jest unit tests in `frontend/__tests__/useDragAndDrop.test.ts`: mock `apiClient` to return an error; assert the card position is restored to its pre-drop value and `lib/toast.error` is called
    - _Requirements: REQ-9.7–9.9, REQ-19.3, REQ-21.1_

  - [ ] 14.4 Create Next.js middleware
    - Create `frontend/middleware.ts` (Edge middleware; on Next.js 16+ the file is `frontend/proxy.ts` instead): read the `revotask_token` cookie; redirect unauthenticated requests to protected routes to `/login`; explicitly exclude `/login` and `/register` from protection; use `NextResponse.redirect`
    - _Requirements: REQ-4.1_

- [ ] 15. Auth pages
  - [ ] 15.1 Create root layout and authenticated route-group layout
    - Create `frontend/app/layout.tsx`: root layout wrapping children with `AuthContextProvider` and `react-hot-toast` `Toaster` only
    - Create `frontend/app/(app)/layout.tsx`: authenticated route-group layout rendering `Header` with `NotificationBell`; wraps `/`, `/boards/[id]`, `/my-tasks`, `/profile` — never `/login` or `/register`
    - _Requirements: REQ-29.1–29.3_

  - [ ] 15.2 Implement the login page
    - Create `frontend/app/login/page.tsx` as a Client Component; controlled inputs for email and password; on submit call `POST /api/auth/login` via `lib/apiClient`; on success store JWT using `lib/auth.setToken`, call `setAuth`, redirect to `/`; on error display the message from `{ "error": "..." }` envelope inline and remain on `/login`
    - _Requirements: REQ-3.1–3.6_

  - [ ] 15.3 Implement the register page
    - Create `frontend/app/register/page.tsx` as a Client Component; controlled inputs for name, email, password; client-side validation before API call: name non-empty, email valid format, password ≥ 8 chars; show inline error per failing field; on success navigate to `/login`; if API returns error display envelope message
    - _Requirements: REQ-2.5, REQ-25.1–25.7_

- [ ] 16. Header and notifications
  - [ ] 16.1 Implement Header component
    - Create `frontend/components/Header.tsx` as a Client Component; render nav links to `/` (Dashboard), `/my-tasks`, `/profile`; render `NotificationBell`; render logout button that calls `lib/auth.clearToken()`, `clearAuth()`, and redirects to `/login`
    - _Requirements: REQ-4.3, REQ-4.4, REQ-29.1, REQ-29.3_

  - [ ] 16.2 Implement NotificationBell component
    - Create `frontend/components/notifications/NotificationBell.tsx`; use `useNotifications` hook to get `unreadCount` and `notifications`; display the unread count badge; on open render a dropdown list of notifications; when the user clicks an unread notification call `PATCH /api/notifications/<id>/read` and decrement the displayed count
    - _Requirements: REQ-11.7, REQ-29.2, REQ-29.4–29.5_

- [ ] 17. Dashboard page
  - [ ] 17.1 Implement the Dashboard (`/`) page and CreateBoardModal
    - Create `frontend/app/(app)/page.tsx` as a Next.js Server Component; fetch `GET /api/boards` server-side via `lib/apiClient` before the page is sent to the client; render a list of boards or an empty state when the user has none
    - Create `frontend/components/board/CreateBoardModal.tsx` as a Client Component inside `BaseModal`; create-board form; call `POST /api/boards`; call `router.refresh()` after success so the Dashboard Server Component re-fetches the board list (REQ-26.5)
    - _Requirements: REQ-26.1–26.5, REQ-32.5_

- [ ] 18. Board detail page and Kanban components
  - [ ] 18.1 Implement board components: ColumnList, AddColumnForm, AddCardForm
    - Create `frontend/components/board/ColumnList.tsx`: render columns in ascending `order`; compose `AddColumnForm` and `AddCardForm` per column
    - Create `frontend/components/board/AddColumnForm.tsx` as a Client Component inside `BaseModal`; call `POST /api/boards/<id>/columns` on submit
    - Create `frontend/components/board/AddCardForm.tsx` as a Client Component inside `BaseModal`; call `POST /api/columns/<id>/cards` on submit; at minimum accept card title
    - _Requirements: REQ-27.2–27.5, REQ-32.5_

  - [ ] 18.2 Implement CommentList component
    - Create `frontend/components/board/CommentList.tsx`: render comments in chronological order; show inline edit and delete controls only to the comment author (compare comment `author.id` with `AuthContext` user id); on edit call `PATCH /api/comments/<id>`; on delete call `DELETE /api/comments/<id>`
    - _Requirements: REQ-28.4, REQ-28.6–28.9_

  - [ ] 18.3 Implement CardDetailModal component
    - Create `frontend/components/board/CardDetailModal.tsx` as a Client Component rendered inside `BaseModal`; display editable fields for title, description, assignee (populated via `GET /api/boards/<id>/members`), due date, and priority; on change call `PATCH /api/cards/<id>`; include a "Move to column" `<select>` that calls `PATCH /api/cards/<id>/position`; compose `CommentList`; include a comment form that calls `POST /api/cards/<id>/comments`
    - _Requirements: REQ-28.1–28.5, REQ-9.10, REQ-32.5_

  - [ ] 18.4 Implement CardItem component
    - Create `frontend/components/board/CardItem.tsx`: render a draggable card row; attach drag handle using `useDragAndDrop`; open `CardDetailModal` on click
    - _Requirements: REQ-27.7, REQ-9.9_

  - [ ] 18.5 Implement KanbanBoard and board detail page
    - Create `frontend/components/board/KanbanBoard.tsx` as a Client Component island; own drag-and-drop state via `useDragAndDrop`; render `ColumnList`; manage card search input with 300 ms debounce — on search call `GET /api/cards?board_id=<id>&q=<text>` and render only returned cards while keeping all columns visible
    - Create `frontend/app/(app)/boards/[id]/page.tsx` as a Next.js Server Component; fetch `GET /api/boards/<id>` server-side; pass data to the `KanbanBoard` Client Component island; allow horizontal scrolling at narrow viewports using Tailwind `overflow-x-auto`
    - _Requirements: REQ-27.1–27.7, REQ-13.2, REQ-20.2_

- [ ] 19. My Tasks and Profile pages
  - [ ] 19.1 Implement My Tasks page
    - Create `frontend/app/(app)/my-tasks/page.tsx`; call `GET /api/cards?assignee=me`; group returned cards by `board_name`; render each card's priority using `BaseBadge`; use `BaseButton` for all button elements
    - _Requirements: REQ-12.4–12.5, REQ-32.3_

  - [ ] 19.2 Implement Profile page
    - Create `frontend/app/(app)/profile/page.tsx` as a Client Component; pre-fill name and email inputs from `AuthContext`; controlled inputs managed by React state; on submit call `PATCH /api/users/me`; on success call `lib/toast.success`; use `BaseButton` for all button elements
    - _Requirements: REQ-14.4, REQ-14.6–14.8, REQ-32.4_

- [ ] 20. Responsive and accessibility polish
  - [ ] 20.1 Apply responsive utilities and accessibility attributes
    - Verify every page renders without cut-off at 375 px viewport; apply Tailwind responsive utilities where needed
    - Ensure every form input has an associated visible `<label>` element
    - Verify `BaseBadge` renders text alongside colour for each priority variant
    - Confirm `BaseModal` returns focus to the trigger element on close and closes on Escape
    - _Requirements: REQ-20.1–20.3, REQ-24.1–24.3_

- [ ] 21. Frontend checkpoint — Ensure all unit tests pass
  - Run `npm test` from `frontend/` and confirm the hook tests (`useErrorHandler`, `useNotifications`, `useDragAndDrop`) and the shared component tests (`BaseButton`, `BaseBadge`, `BaseModal`) all pass; resolve any failures before deploy.
  - _Requirements: REQ-23.2_

- [ ] 22. Vercel deploy
  - [ ] 22.1 Configure and deploy the frontend to Vercel
    - Connect the `frontend/` directory to a Vercel project; set environment variables: `NEXT_PUBLIC_API_BASE_URL` (the API's public Vercel URL) and `API_BASE_URL` (the same URL, read by Server Components)
    - After the first Vercel deploy, add the web app's production URL to `CORS_ORIGINS` on the API's Vercel project and redeploy the API
    - Verify that the live Vercel URL loads the login page and that a browser login from the live site succeeds and reaches the dashboard
    - _Requirements: REQ-31.1–31.2_

  - [ ] 22.2 Verify the board-load performance target on production
    - Seed one board with 200 cards on the live API (script or API calls with a test account)
    - Measure `GET /api/boards/<id>` at least 20 times and record the 95th percentile; it must be under 500 ms; record the result in the README
    - _Requirements: REQ-19.1_

- [ ] 23. Playwright E2E tests
  - [ ] 23.0 Set up Playwright
    - Install `@playwright/test` in `frontend/` and run `npx playwright install` once
    - Create `frontend/playwright.config.ts`: `testDir: "./e2e"`, `baseURL` from the `E2E_BASE_URL` env var (the live Vercel URL), HTML reporter writing to `frontend/playwright-report/`
    - Create `frontend/e2e/helpers.ts`: register a unique test user per run through `POST /api/auth/register` on the live API (unique email per run), and export a `login(page, user)` helper
    - _Requirements: REQ-23.2, REQ-23.3_

  - [ ] 23.1 Implement auth E2E scenarios
    - Create `frontend/e2e/auth.spec.ts`; use `role` and `data-testid` selectors; use `expect(locator)` web-first assertions; do NOT use `waitForTimeout`
    - Scenario 1: successful login → navigate to `/login`, fill credentials, submit, `expect(page).toHaveURL('/')`
    - Scenario 2: invalid credentials → submit wrong password, `expect(locator).toContainText(...)` for error message, URL stays `/login`
    - Scenario 3: unauthenticated visit to `/` → `expect(page).toHaveURL('/login')`
    - Scenario 4: after logout → click logout, visit `/`, `expect(page).toHaveURL('/login')`
    - _Requirements: REQ-23.4_

  - [ ] 23.2 Implement Kanban journey E2E scenario
    - Create `frontend/e2e/kanban.spec.ts`; use `role` and `data-testid` selectors; use `waitForResponse` to await API calls; do NOT use `waitForTimeout`
    - Step 1: log in
    - Step 2: open CreateBoardModal, create a board, assert it appears in the dashboard list
    - Step 3: add a "To Do" column via AddColumnForm
    - Step 4: add a "Done" column via AddColumnForm
    - Step 5: add a card in the "To Do" column via AddCardForm
    - Step 6: drag the card to "Done" using `locator.dragTo()`; use `waitForResponse(resp => resp.url().includes('/position') && resp.status() === 200)` to confirm the API call succeeds
    - Step 7: reload the page with `page.reload()`
    - Step 8: `expect(locator in Done column).toContainText(cardTitle)`
    - _Requirements: REQ-23.5_

- [ ] 24. Final checkpoint — Ensure all tests pass
  - Run `pytest backend/tests/` (all backend tests) and the Playwright suite against the live web and API URLs; resolve any failures.
  - _Requirements: REQ-23.1–23.5_

- [ ] 25. Deliverables
  - [ ] 25.1 Publish the accepted specification documents
    - Copy the accepted `requirements.md`, `design.md` and `tasks.md` from `.kiro/specs/revotask-mvp/` into `/specs`, next to `project-brief.md` and `CHANGELOG.md`
    - _Requirements: REQ-22.1_

  - [ ] 25.2 Verify the live API with Postman
    - On the public API URL call `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, and at least one endpoint of each of the 8 blueprints; confirm every response uses the `{ "data": ... }` or `{ "error": "..." }` envelope; save a screenshot
    - _Requirements: REQ-1.1, REQ-17.1–17.2_

  - [ ] 25.3 Run the Playwright suite against the live URL and commit the report
    - Run `npx playwright test` from `frontend/` with `E2E_BASE_URL` set to the Vercel URL; all tests must pass; commit `frontend/playwright-report/`; confirm `waitForTimeout` appears nowhere in `frontend/e2e/`
    - _Requirements: REQ-23.3–23.5_

  - [ ] 25.4 Write `README.md`
    - Sections: overview, AI workflow summary (which tool was used in which phase), features, technologies, local run steps for both projects, test steps for pytest / `npm test` / Playwright, and screenshots (Postman, every major page, a card being dragged, the notification bell with an unread count, the mobile view, the Playwright report)
    - _Requirements: REQ-20.1_

  - [ ] 25.5 Write the guideline violation report
    - List at least 3 guideline violations found in AI-generated code; for each: the file, the guideline it breaks, and the fix applied
    - _Requirements: REQ-22.1–22.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP (there are no optional sub-tasks in this plan — all tests are core requirements per REQ-23).
- The `AppError` pattern means `routes.py` files contain no `try/except`; all business errors bubble up to the app-factory error handlers.
- `BoardColumn` is the Python class name throughout; `__tablename__ = "columns"` for the database table.
- Property tests (Properties 1–4) use ordinary parametrised `pytest.mark.parametrize` cases, not Hypothesis.
- **Property 6** (password never in response) and **Property 7** (non-member gets 404) and **Property 8** (envelope invariant) are enforced structurally via schema design and are verified implicitly by every endpoint test asserting on response structure.
- `router.refresh()` in `CreateBoardModal` is the App Router mechanism for revalidating Server Component data after a mutation.
- All `db.DateTime` columns use `timezone=True` and `default=lambda: datetime.now(timezone.utc)`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1"] },
    { "id": 1, "tasks": ["1.1"] },
    { "id": 2, "tasks": ["1.2"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["6.1"] },
    { "id": 10, "tasks": ["6.2"] },
    { "id": 11, "tasks": ["7.1"] },
    { "id": 12, "tasks": ["7.2"] },
    { "id": 13, "tasks": ["8.1"] },
    { "id": 14, "tasks": ["8.2"] },
    { "id": 15, "tasks": ["9.1"] },
    { "id": 16, "tasks": ["9.2"] },
    { "id": 17, "tasks": ["10.1"] },
    { "id": 18, "tasks": ["10.2"] },
    { "id": 19, "tasks": ["11.1"] },
    { "id": 20, "tasks": ["11.2"] },
    { "id": 21, "tasks": ["13.1"] },
    { "id": 22, "tasks": ["13.2", "13.3"] },
    { "id": 23, "tasks": ["13.4", "13.5"] },
    { "id": 24, "tasks": ["13.6"] },
    { "id": 25, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 26, "tasks": ["15.1"] },
    { "id": 27, "tasks": ["15.2", "15.3"] },
    { "id": 28, "tasks": ["16.1"] },
    { "id": 29, "tasks": ["16.2"] },
    { "id": 30, "tasks": ["17.1"] },
    { "id": 31, "tasks": ["18.1", "18.2"] },
    { "id": 32, "tasks": ["18.3"] },
    { "id": 33, "tasks": ["18.4"] },
    { "id": 34, "tasks": ["18.5"] },
    { "id": 35, "tasks": ["19.1", "19.2"] },
    { "id": 36, "tasks": ["20.1"] },
    { "id": 37, "tasks": ["22.1"] },
    { "id": 38, "tasks": ["22.2", "23.0"] },
    { "id": 39, "tasks": ["23.1", "23.2"] },
    { "id": 40, "tasks": ["25.1", "25.2", "25.3"] },
    { "id": 41, "tasks": ["25.4", "25.5"] }
  ]
}
```
