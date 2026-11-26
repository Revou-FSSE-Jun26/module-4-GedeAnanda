# RevoTask — Project Brief

| Field   | Value                                                                 |
| ------- | --------------------------------------------------------------------- |
| Version | 0.1 (draft)                                                           |
| Date    | 2026-11-26                                                            |
| Status  | Draft — input for Kiro spec generation (`requirements.md` → `design.md` → `tasks.md`) |
| Scope   | Flask REST API + Next.js web app, both deployed publicly              |

---

## 1. Overview

RevoTask is a Trello-like task management web application. Users create **boards**, split work into **columns** (for example *To Do → In Progress → Done*), add **cards** for individual tasks, and move cards between columns with **drag-and-drop**. Team members discuss work through **comments**, get **notifications** when something involves them, and see every task assigned to them on a single **My Tasks** page. Board administrators control who can access a board and monitor progress through per-board **analytics**.

The product has two deployables:

- **RevoTask API**: Flask REST API with PostgreSQL, deployed on Railway.
- **RevoTask Web**: Next.js (App Router) frontend, deployed on Vercel.

The project is built with a spec-driven, AI-assisted workflow. This brief feeds the specification phase. Every AI-generated artifact is reviewed against the steering guidelines before it is committed (see §12).

## 2. Problem and Goals

**Problem.** Small teams track work in chat threads and spreadsheets. Nobody has a shared, current view of what is being worked on, who owns it, or what is finished.

| ID | Goal |
| -- | ---- |
| G1 | Give a team a visual board of work stages where a task's status is updated by dragging it. |
| G2 | Make ownership explicit: a card can have an assignee, and each user has a personal list of assigned tasks. |
| G3 | Keep discussion attached to the work through card comments and in-app notifications. |
| G4 | Give board administrators visibility into progress and team activity. |
| G5 | Demonstrate a traceable AI-assisted SDLC: brief → requirement → design → task → code → test. |

## 3. User Roles

Roles are **per board** and stored on the board membership (`BoardMember.role = "admin" | "member"`). The user who creates a board becomes its admin. One user can be an admin on one board and a member on another.

| Role | Who | Can | Cannot |
| ---- | --- | --- | ------ |
| **Guest** | Not logged in | Register, log in | Reach any other page or endpoint (page redirects to `/login`; API returns `401`) |
| **Board member** | User added to a board | View the board; create, rename and reorder columns; create, edit and move cards; delete cards they created; comment; edit and delete **own** comments; be assigned cards; see My Tasks; receive notifications; update own profile | Rename or delete the board; delete columns; manage members; view analytics; edit or delete other users' comments |
| **Board administrator** | Board creator, or a member promoted by an admin | Everything a member can, plus: rename and delete the board, delete columns, delete any card, add and remove members, change member roles, view board analytics | Edit or delete other users' comments (comment edit/delete stays owner-only); remove the board's last admin |

**Authorization rule of thumb.** A user who is not a member of a board gets `404` for that board and everything inside it, so the board's existence is not leaked. A member without the needed role or ownership gets `403`.

## 4. Core Features (MVP)

| ID | Feature | Summary |
| -- | ------- | ------- |
| F1 | Authentication | Register with a hashed password; log in to receive a JWT with an expiry; protected pages and endpoints; logout. |
| F2 | Board management | Create, list (boards the user belongs to), view with nested columns and cards, rename, delete. |
| F3 | Column management | Add, rename, delete, and reorder columns using a FLOAT `order` value. |
| F4 | Card management | Create, edit (title, description, assignee, due date, priority), soft-delete, and move cards within or between columns with drag-and-drop. Card positions use FLOAT `order`. The UI updates optimistically and rolls back on API error. |
| F5 | Comments | Add and list comments on a card; edit and delete own comments only. |
| F6 | Notifications | In-app notifications created on key events (see §5.7). The header bell shows the unread count, refreshed by polling every 30 seconds; a notification can be marked as read; the list is paginated. |
| F7 | My Tasks | All non-deleted cards assigned to the current user, grouped by board name. |
| F8 | Card search | Search box on the board page that filters cards by title, debounced by 300 ms. |
| F9 | Profile | View and update own name and email. Password changes are not allowed here. |
| F10 | Board analytics | Per board: total cards per column, cards completed this week, and per-member activity, computed with SQLAlchemy joins in the service layer. |
| F11 | Member access management | Admin adds a member by email, removes a member, and changes a member's role. |

### Card fields

| Field | Rule |
| ----- | ---- |
| `title` | Required, 1–200 characters |
| `description` | Optional, up to 5,000 characters |
| `assignee_id` | Optional; must be a member of the card's board |
| `due_date` | Optional date |
| `priority` | `low` \| `medium` \| `high`, default `medium`; shown with `BaseBadge` color variants |
| `order` | `db.Float`, greater than 0 |
| `completed_at` | Set by the server; see §5.5 |

## 5. Gaps in the Assignment and Decisions Taken

The assignment leaves several behaviors undefined or contradictory. The decisions below fix them **before** spec generation, so the AI tool does not invent its own answers.

### 5.1 Missing endpoint for My Tasks and search

`/my-tasks` calls `GET /api/cards?assignee=me`, but the Cards Blueprint does not list a `GET /api/cards` endpoint. Card search (300 ms debounce) has no endpoint either.

**Decision.** Add `GET /api/cards` to the Cards Blueprint with these query parameters:

- `assignee=me`: cards assigned to the current user, across all of the user's boards.
- `board_id=<uuid>`: limit results to one board.
- `q=<text>`: case-insensitive title match (`ILIKE`).

Results only include cards on boards the user belongs to, and never include soft-deleted cards.

### 5.2 Missing endpoints for member access

Admins must "manage member access", but no endpoint exists for it.

**Decision.** Add to the Boards Blueprint:

- `GET /api/boards/<id>/members`
- `POST /api/boards/<id>/members` (body: `email`, `role`)
- `PATCH /api/boards/<id>/members/<user_id>` (body: `role`)
- `DELETE /api/boards/<id>/members/<user_id>`

### 5.3 Missing health endpoint

Deliverable 3 requires `GET /api/health`, but no blueprint lists it.

**Decision.** Register it in the app factory, outside the feature blueprints. It returns `200 { "data": { "status": "ok" } }` after a trivial database query succeeds.

### 5.4 Server Components cannot read the JWT from `AuthContext`

The Dashboard and Board Detail pages are Server Components, but the brief stores the JWT in `AuthContext`, which only exists on the client.

**Decision.** On login, store the token in **both** places:

- a cookie (`revotask_token`, `SameSite=Lax`, `Secure` in production, expiry equal to the JWT's), read by Server Components through `cookies()` and by `middleware.ts` for redirects;
- `AuthContext`, hydrated from that cookie on page load and used by Client Components.

Logout clears both.

**Accepted trade-off.** The cookie can be read by JavaScript, so an XSS bug could steal it. This is mitigated by React's output escaping, a ban on `dangerouslySetInnerHTML`, and a short token lifetime. An httpOnly cookie behind a Next.js proxy was considered and rejected as too complex for the MVP.

### 5.5 "Cards completed this week" is undefined

**Decision.** A column has a boolean `is_done` flag. When a card moves into an `is_done` column, the server sets `completed_at`; when it moves out, the server clears it. "Completed this week" counts cards whose `completed_at` falls in the current ISO week (Monday 00:00 UTC to now).

### 5.6 "Member activity" is undefined

**Decision.** For each board member, return:

- the number of cards they created on the board;
- the number of cards currently assigned to them;
- the number of comments they wrote on the board in the last 7 days.

### 5.7 Notification triggers are undefined

**Decision.** A notification is created when:

| ID | Event | Recipient |
| -- | ----- | --------- |
| N1 | A card is assigned to a user | The new assignee |
| N2 | A comment is added to a card | The card's creator and its assignee |
| N3 | A user is added to a board | The added user |

The user who performed the action is never notified about their own action.

### 5.8 Delete semantics

Only `Card` is required to have `deleted_at`.

**Decision.**

- `DELETE /api/cards/<id>` is a **soft delete**: it sets `deleted_at`, and every read query filters `deleted_at IS NULL`.
- Boards and columns are **hard-deleted** and cascade to their children.
- Deleting a column is admin-only because it removes every card in the column.

### 5.9 Response envelope details

**Decision.**

- **Success** returns `{ "data": ... }`.
- **Error** returns `{ "error": "<human-readable message>" }`.
- **Delete** returns `200 { "data": { "id": "<uuid>" } }`. `204` is not used, so every response keeps the envelope.
- **Pagination** lives inside `data`: `{ "data": { "items": [...], "page": 1, "per_page": 20, "total": 42, "unread_count": 3 } }`. The default `per_page` is 20 and the maximum is 100.
- **Status codes:**
  - `200` OK
  - `201` created
  - `400` validation error
  - `401` missing or invalid token
  - `403` forbidden
  - `404` not found or not a member
  - `409` conflict, for example an email already registered

### 5.10 Drag-and-drop on touch devices

Support for the native HTML5 Drag and Drop API on touch browsers is limited and inconsistent.

**Decision.** Desktop uses drag-and-drop through `useDragAndDrop`. `CardDetailModal` also has a **"Move to column"** select that calls the same `PATCH /api/cards/<id>/position` endpoint, so cards can still be moved on mobile.

### 5.11 Logout

There is no logout endpoint.

**Decision.** Logout is client-side only: clear the cookie and `AuthContext`, then redirect to `/login`. JWTs are stateless, and a server-side token blocklist is out of scope.

### 5.12 FLOAT order strategy

**Decision.**

- **Append to the end of a list:** `order = last.order + 1024`.
- **Insert between two items:** `order = (prev.order + next.order) / 2`.
- **Insert at the top:** `order = first.order / 2`.
- **Rebalance:** when the gap between neighbors drops below `1e-6`, the service renumbers that column's cards to `1024, 2048, 3072, …` in one transaction.

`CardPositionSchema` validates `column_id` (UUID, must belong to the same board) and `order` (float, greater than 0). Columns use the same strategy within a board.

## 6. Tech Stack

| Layer | Technology | Purpose |
| ----- | ---------- | ------- |
| Frontend framework | Next.js (App Router), React, TypeScript (strict) | Pages, Server and Client Components |
| Styling | Tailwind CSS | Utility-first styling, responsive layout |
| Feedback | react-hot-toast | Success, error and loading toasts via `lib/toast.ts` |
| Frontend tests | Jest + React Testing Library (`npm test`) | Component and hook tests |
| E2E tests | Playwright (`npx playwright test`) | Auth and Kanban journeys against the live Vercel URL |
| Backend framework | Flask (app factory + Blueprints) | REST API |
| ORM and migrations | SQLAlchemy (Flask-SQLAlchemy), Flask-Migrate | Models and versioned schema migrations |
| Auth | Flask-JWT-Extended, Werkzeug password hashing | JWT issue and verification, password hashing |
| Validation | Marshmallow | Request validation and response serialization |
| CORS | Flask-CORS | Allow-list for the Vercel origin |
| Config | python-dotenv | Environment variables from `.env` |
| Database | PostgreSQL | Production on Railway; separate database for tests |
| Server | Gunicorn | Production WSGI server |
| Backend tests | pytest (`pytest -v`) | Unit and API tests per blueprint |
| Hosting | Railway (API + PostgreSQL), Vercel (web) | Public deployments |

### AI tools (hybrid workflow)

| Tool | Used for |
| ---- | -------- |
| **Kiro** (Spec mode) | Generating and iterating `requirements.md`, `design.md` and `tasks.md` from this brief |
| **Kiro** (Steering) | Authoring steering files that become `/guidelines/frontend.md`, `backend.md` and `database.md` |
| **Kiro CLI** | Generating and refining tests and documentation drafts |
| **Claude Code** | Code generation per task in `tasks.md`, review against the guidelines, debugging, and deployment |

Every AI output is reviewed by the author. The raw output is kept before it is edited, so each refinement can be logged as a before/after entry in `CHANGELOG.md` or the violation report.

## 7. Non-Functional Requirements

| ID | Category | Requirement | How it is verified |
| -- | -------- | ----------- | ------------------ |
| NFR-1 | Security | Passwords are hashed and never stored or returned in plain text. Every endpoint except register, login and health requires a valid JWT. JWTs expire after 24 hours. Authorization is enforced in the service layer. CORS only allows origins listed in an environment variable. Secrets live only in environment variables, and real `.env*` files are git-ignored. | pytest `401`/`403` cases; `GET /api/users/me` response has no password field; repo has no `.env` |
| NFR-2 | Performance | `GET /api/boards/<id>` responds in under 500 ms (p95) for a board with up to 200 cards on the production deployment, using eager loading and no N+1 queries. Card moves update the UI optimistically, before the API responds. | Timing from Postman or the browser network tab; query count checked in a test |
| NFR-3 | Responsiveness | Every page is usable at 375 px width with no cut-off or overlapping content. The Kanban board scrolls horizontally on small screens by design. Tap targets are at least 44 × 44 px. | DevTools device-mode screenshots |
| NFR-4 | Reliability | A failed card move restores the card to its original position and shows an error toast. The API always answers in the JSON envelope, never with an HTML error page or a stack trace, and production runs with debug mode off. | `useDragAndDrop` test with a mocked API error; pytest for error handlers |
| NFR-5 | Maintainability | Each feature is a Blueprint with `routes.py` (HTTP only), `service.py` (business logic and queries) and `schema.py` (Marshmallow). The frontend reuses `components/shared` (`BaseButton`, `BaseBadge`, `BaseModal`) instead of one-off elements. TypeScript runs in strict mode with no `any`. | Folder structure review; lint and type-check pass |
| NFR-6 | Testability | Every blueprint has pytest coverage for its success path and for `400`/`401`/`403`/`404` where they apply. E2E tests use role or `data-testid` selectors and web-first assertions, with no `waitForTimeout`. | `pytest -v` and `npx playwright test` reports; `grep waitForTimeout` returns nothing |
| NFR-7 | Accessibility (baseline) | Form inputs have labels. Modals close on Esc and return focus to the element that opened them. Status is never conveyed by color alone (badges also show text). | Manual keyboard pass; React Testing Library queries by role and label |

## 8. Data Model (high level)

Every table uses a **UUID primary key** plus `created_at` and `updated_at`. Detailed columns, constraints and indexes belong in `design.md`.

| Entity | Key fields | Relationships |
| ------ | ---------- | ------------- |
| User | `name`, `email` (unique), `password_hash` | Has many board memberships, cards created, cards assigned, comments, notifications |
| Board | `name`, `owner_id` | Has many BoardMembers and Columns |
| BoardMember | `board_id`, `user_id`, `role` (`admin`/`member`), unique `(board_id, user_id)` | Join between User and Board |
| Column | `board_id`, `name`, `order` (`db.Float`), `is_done` (bool) | Belongs to Board; has many Cards |
| **Card** | `column_id`, `title`, `description`, `priority`, `due_date`, `assignee_id`, `created_by`, **`order` (`db.Float`)**, `completed_at`, **`deleted_at`** | Belongs to Column; has many Comments |
| Comment | `card_id`, `author_id`, `content` (1–2,000 chars) | Belongs to Card and User |
| Notification | `user_id`, `type` (`card_assigned`/`comment_added`/`board_invite`), `message`, `card_id` / `board_id` (nullable), `is_read` | Belongs to User |

## 9. Pages and Components (frontend)

| Route / component | Type | Purpose |
| ----------------- | ---- | ------- |
| `/register` | Client | Registration form with controlled inputs and client-side validation |
| `/login` | Client | Login form; on success stores the token (§5.4) and redirects to `/` |
| `/` | Server | Dashboard listing the user's boards, with a create-board action |
| `/boards/[id]` | Server, with client islands | Kanban layout; client islands handle drag-and-drop, search and modals |
| `CardDetailModal.tsx` | Client | Card details, "Move to column" select, and `CommentList` with a comment form, inside `BaseModal` |
| `/my-tasks` | Client or Server | Assigned cards grouped by board name |
| `/profile` | Client | Name and email form pre-filled from `AuthContext` |
| Header | Client | Navigation, `NotificationBell` with unread count, logout |

Shared building blocks:

- `components/shared/BaseButton`, `BaseBadge`, `BaseModal`
- `hooks/useDragAndDrop`, `useNotifications`, `useErrorHandler`
- `lib/apiClient`, `lib/errors`, `lib/toast`

## 10. Success Criteria (Definition of Done)

1. `GET /api/health` returns `200` on the public Railway URL. Register and login return JSON in the envelope, verified in Postman.
2. All 8 blueprints (auth, boards, columns, cards, comments, notifications, analytics, users) are reachable on the public URL, and every migration has been applied with `flask db upgrade`.
3. On the live Vercel app, a user can: register; log in; create a board; add columns; create a card; drag it to another column and still see it there after a refresh; open the card; add and edit a comment; find a card through search; and see an unread count on the notification bell.
4. `pytest -v` passes. The comment tests cover `201` success, `400` missing content, `401` unauthenticated and `403` not the owner.
5. The Playwright suite passes against the live URL and covers:
   - **Auth (4 scenarios):**
     1. A successful login redirects to `/`.
     2. Invalid credentials show an error.
     3. An unauthenticated visit to `/` redirects to `/login`.
     4. After logout, visiting `/` redirects to `/login`.
   - **Kanban journey (8 steps):**
     1. Log in.
     2. Create a board.
     3. Add a "To Do" column.
     4. Add a "Done" column.
     5. Create a card in "To Do".
     6. Drag the card to "Done".
     7. Reload the page.
     8. Assert the card is still in "Done".
6. The app is usable at mobile size, confirmed with device-mode screenshots.

## 11. Out of Scope

- Real-time updates (WebSockets); notifications use polling
- File attachments, checklists, labels other than priority
- Email notifications
- Refresh tokens, password reset, password change, OAuth or social login
- Board templates, archiving, organizations or workspaces
- Offline mode

## 12. Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Railway provides `DATABASE_URL` with the `postgres://` scheme, which SQLAlchemy rejects | Normalize it to `postgresql://` in config; require SSL in production |
| CORS failures between the Vercel and Railway domains | `CORS_ORIGINS` env allow-list; deploy early and test from the live frontend |
| Migrations not applied on deploy | Run `flask db upgrade` as Railway's pre-deploy or start step |
| Float precision runs out after many moves | Rebalance strategy (§5.12) |
| Playwright native drag-and-drop is flaky | Use `locator.dragTo()`, wait for the `PATCH /position` response with `waitForResponse`, then assert on the DOM; never `waitForTimeout` |
| AI-generated code violates the steering guidelines | Review every generated file against `/guidelines` before committing; log findings in the violation report |
| Spec drift between documents and code | Keep IDs (F#, NFR#, requirement and task IDs) traceable across `requirements.md`, `design.md`, `tasks.md` and the code |

## 13. How This Brief Is Used (AI workflow)

1. **Brief** (this document): written by the author with AI assistance and reviewed manually.
2. **Specs**: this brief is given to Kiro Spec mode to generate `requirements.md` with an acceptance criterion for every requirement. The author reviews it against this brief, writes targeted refinement prompts, and logs each round in `specs/CHANGELOG.md` with a before and an after. The same loop produces `design.md` and `tasks.md`.
3. **Guidelines**: Kiro steering files are written **before** any code. Each rule has a Rule, a Rationale and a RevoTask Example. They are copied to `/guidelines`.
4. **Code**: Claude Code implements `tasks.md` one task at a time, with the guidelines loaded as project instructions. Each generated file is reviewed, and violations go into the violation report.
5. **Tests and docs**: Kiro CLI and Claude Code generate and refine the pytest, React Testing Library and Playwright tests and the README. They are reviewed and run before every commit.

---

### Document history

| Version | Date | Change |
| ------- | ---- | ------ |
| 0.1 | 2026-11-26 | First draft, prepared with AI assistance (Claude Code) from the assignment text. Pending the author's review. |
