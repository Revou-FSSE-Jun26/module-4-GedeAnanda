# Requirements Document

## Introduction

RevoTask is a Trello-like task management web application consisting of two deployables: the RevoTask API (Flask REST API with PostgreSQL, deployed on Railway) and RevoTask Web (Next.js App Router frontend, deployed on Vercel). Users create boards, organise work into columns, manage cards with drag-and-drop, discuss tasks through comments, receive in-app notifications, and view all assigned tasks on a personal My Tasks page. Board administrators control membership and monitor progress through per-board analytics. This document covers the full MVP feature set (F1–F11) and non-functional requirements (NFR-1–NFR-7).

## Glossary

- **API**: The RevoTask Flask REST API, deployed on Railway.
- **Web**: The RevoTask Next.js frontend, deployed on Vercel.
- **Guest**: A user who is not authenticated; can only access the register and login pages/endpoints.
- **Member**: A user who belongs to a board with the role `member`.
- **Admin**: A user who belongs to a board with the role `admin`.
- **Board**: A named workspace containing an ordered set of Columns.
- **Column**: A named, ordered stage within a Board (e.g. "To Do", "In Progress", "Done"); has a boolean `is_done` flag.
- **Card**: A task item within a Column; fields: `title`, `description`, `assignee_id`, `due_date`, `priority`, `order`, `completed_at`, `deleted_at`.
- **Comment**: A text message (1–2,000 characters) attached to a Card, authored by a User.
- **Notification**: An in-app message delivered to a User when a qualifying event occurs (card assigned, comment added, board invite).
- **BoardMember**: The join record between a User and a Board, storing the user's `role` on that board.
- **JWT**: JSON Web Token issued by the API on login, valid for 24 hours.
- **Soft-delete**: Setting `deleted_at` on a Card without removing the row; all read queries filter `deleted_at IS NULL`.
- **Hard-delete**: Physically removing a row and cascading to child rows.
- **FLOAT order**: A floating-point position value used to order Cards within a Column and Columns within a Board.
- **Envelope**: The JSON response wrapper; success: `{ "data": ... }`, error: `{ "error": "..." }`.
- **Rebalance**: The operation that renumbers FLOAT order values to `1024, 2048, 3072, ...` when the gap between neighbours drops below `1e-6`.
- **AuthContext**: The React context on the Web that holds the JWT and user identity, hydrated from the `revotask_token` cookie on page load.
- **NotificationBell**: The header component that displays the unread notification count.
- **BaseButton / BaseBadge / BaseModal**: Shared UI components reused across the Web.

---

## Requirements

### REQ-1: Health Check

**Reference:** F — Infrastructure (§5.3)

**User Story:** As a developer, I want a health endpoint, so that I can verify the API and database are reachable before running tests or accepting traffic.

#### Acceptance Criteria

1. WHEN a client sends `GET /api/health`, THE API SHALL return HTTP `200` with the body `{ "data": { "status": "ok" } }` after a trivial database query succeeds.
2. IF the database is unreachable, THEN THE API SHALL return a non-`200` status code with a JSON error envelope.
3. THE API SHALL register the health endpoint in the application factory, outside all feature blueprints.

---

### REQ-2: User Registration

**Reference:** F1

**User Story:** As a Guest, I want to register an account, so that I can access RevoTask.

#### Acceptance Criteria

1. WHEN a Guest submits `POST /api/auth/register` with a unique email and a password, THE API SHALL create a User record with the password stored as a hash and return HTTP `201` with `{ "data": { "id": "<uuid>", "name": "...", "email": "..." } }`.
2. IF the submitted email is already registered, THEN THE API SHALL return HTTP `409` with `{ "error": "<message>" }`.
3. IF the submitted request body is missing `email` or `password`, THEN THE API SHALL return HTTP `400` with `{ "error": "<message>" }`.
4. THE API SHALL never store or return a password in plain text.
5. WHEN registration succeeds, THE Web SHALL display the `/login` page.

---

### REQ-3: User Login

**Reference:** F1

**User Story:** As a Guest, I want to log in, so that I can access my boards and tasks.

#### Acceptance Criteria

1. WHEN a Guest submits `POST /api/auth/login` with valid credentials, THE API SHALL return HTTP `200` with `{ "data": { "access_token": "<jwt>", "user": { "id": "...", "name": "...", "email": "..." } } }` where the JWT expires in 24 hours.
2. IF the submitted credentials are invalid, THEN THE API SHALL return HTTP `401` with `{ "error": "<message>" }`.
3. WHEN login succeeds, THE Web SHALL store the JWT in both the `revotask_token` cookie (`SameSite=Lax`, `Secure` in production, expiry equal to the JWT expiry) and in AuthContext.
4. WHEN login succeeds, THE Web SHALL redirect the user to `/`.
5. THE Web SHALL hydrate AuthContext from the `revotask_token` cookie on page load.

---

### REQ-4: Protected Routes and Logout

**Reference:** F1, §5.4, §5.11

**User Story:** As a logged-in user, I want protected pages and a logout action, so that my data is not accessible to unauthenticated visitors.

#### Acceptance Criteria

1. WHEN a Guest navigates to any page other than `/register` or `/login`, THE Web SHALL redirect the Guest to `/login`.
2. WHEN an unauthenticated request reaches any API endpoint other than `POST /api/auth/register`, `POST /api/auth/login`, or `GET /api/health`, THE API SHALL return HTTP `401`.
3. WHEN a logged-in user triggers logout, THE Web SHALL clear the `revotask_token` cookie, clear AuthContext, and redirect to `/login`.
4. THE Web SHALL perform logout on the client side only, without calling a server logout endpoint.

---

### REQ-5: Board Management

**Reference:** F2

**User Story:** As a logged-in user, I want to create, view, rename, and delete boards, so that I can organise work for my team.

#### Acceptance Criteria

1. WHEN a logged-in user submits `POST /api/boards` with a board name, THE API SHALL create a Board, add the requesting user as a BoardMember with `role = "admin"`, and return HTTP `201` with `{ "data": { "id": "...", "name": "...", ... } }`.
2. WHEN a logged-in user sends `GET /api/boards`, THE API SHALL return HTTP `200` with a list of all boards the user belongs to as a member or admin.
3. WHEN a Member or Admin sends `GET /api/boards/<id>`, THE API SHALL return HTTP `200` with the board, its ordered columns, and each column's non-deleted cards, using eager loading with no N+1 queries.
4. WHEN an Admin sends `PATCH /api/boards/<id>` with a new name, THE API SHALL update the board name and return HTTP `200`.
5. WHEN an Admin sends `DELETE /api/boards/<id>`, THE API SHALL hard-delete the board and cascade to its columns and cards, returning HTTP `200` with `{ "data": { "id": "<uuid>" } }`.
6. IF a user who is not a BoardMember of the requested board sends any request to `/api/boards/<id>` or its sub-resources, THEN THE API SHALL return HTTP `404`.
7. IF a Member (non-Admin) attempts to rename or delete a board, THEN THE API SHALL return HTTP `403`.

---

### REQ-6: Column Management

**Reference:** F3

**User Story:** As a Member or Admin, I want to add, rename, reorder, and delete columns, so that I can define the work stages on a board.

#### Acceptance Criteria

1. WHEN a Member or Admin sends `POST /api/boards/<id>/columns` with a column name, THE API SHALL create a Column with an `order` value equal to the last column's order plus `1024` and return HTTP `201`.
2. WHEN a Member or Admin sends `PATCH /api/columns/<id>` with a new name or `is_done` value, THE API SHALL update the Column and return HTTP `200`.
3. WHEN an Admin sends `DELETE /api/columns/<id>`, THE API SHALL hard-delete the Column and all its Cards, returning HTTP `200` with `{ "data": { "id": "<uuid>" } }`.
4. IF a Member (non-Admin) attempts to delete a column, THEN THE API SHALL return HTTP `403`.
5. THE API SHALL assign FLOAT `order` values using the following strategy: append to end sets `order = last.order + 1024`; insert between two columns sets `order = (prev.order + next.order) / 2`; insert at top sets `order = first.order / 2`; WHEN the gap between neighbouring column order values drops below `1e-6`, THE API SHALL renumber all columns in that board to `1024, 2048, 3072, ...` in a single transaction.
6. THE API SHALL expose a boolean `is_done` flag on each Column; WHEN no value is provided at creation, THE API SHALL default `is_done` to `false`.
7. WHEN a Member or Admin sends `PATCH /api/boards/<id>/columns/reorder` with a `column_id` (UUID of a column on that board) and an `order` (float greater than 0), THE API SHALL update that column's order value and return HTTP `200`.

---

### REQ-7: Card Creation and Editing

**Reference:** F4

**User Story:** As a Member or Admin, I want to create and edit cards, so that I can track individual tasks on a board.

#### Acceptance Criteria

1. WHEN a Member or Admin sends `POST /api/columns/<col_id>/cards` with at minimum a `title`, THE API SHALL create a Card with the requesting user recorded as `created_by`, `priority` defaulting to `"medium"`, and `order` set to the last card's order plus `1024`, returning HTTP `201`.
2. IF the submitted `title` is absent, fewer than 1 character, or greater than 200 characters, THEN THE API SHALL return HTTP `400`.
3. IF the submitted `description` exceeds 5,000 characters, THEN THE API SHALL return HTTP `400`.
4. IF the submitted `assignee_id` is not a BoardMember of the card's board, THEN THE API SHALL return HTTP `400`.
5. IF the submitted `priority` is not one of `low`, `medium`, or `high`, THEN THE API SHALL return HTTP `400`.
6. WHEN a Member or Admin sends `PATCH /api/cards/<id>` with one or more editable fields (`title`, `description`, `assignee_id`, `due_date`, `priority`), THE API SHALL update the Card and return HTTP `200`.
7. IF a user who is not a BoardMember of the card's board sends any request to `/api/cards/<id>`, THEN THE API SHALL return HTTP `404`.

---

### REQ-8: Card Soft-Delete

**Reference:** F4, §5.8

**User Story:** As a Member or Admin, I want to delete cards, so that completed or irrelevant tasks are removed from the board without permanent data loss.

#### Acceptance Criteria

1. WHEN a Member who created the card sends `DELETE /api/cards/<id>`, THE API SHALL set `deleted_at` on the Card and return HTTP `200` with `{ "data": { "id": "<uuid>" } }`.
2. WHEN an Admin sends `DELETE /api/cards/<id>`, THE API SHALL set `deleted_at` on the Card and return HTTP `200` with `{ "data": { "id": "<uuid>" } }`.
3. IF a Member who did not create the card attempts to delete it, THEN THE API SHALL return HTTP `403`.
4. THE API SHALL exclude soft-deleted cards (where `deleted_at IS NOT NULL`) from all read responses.

---

### REQ-9: Card Move and Position

**Reference:** F4, §5.10, §5.12

**User Story:** As a Member or Admin, I want to move cards within and between columns, so that I can update task status.

#### Acceptance Criteria

1. WHEN a Member or Admin sends `PATCH /api/cards/<id>/position` with a `column_id` and an `order`, THE API SHALL update the Card's column and order and return HTTP `200`.
2. IF the submitted `column_id` does not belong to the same board as the card, THEN THE API SHALL return HTTP `400`.
3. IF the submitted `order` is not a float greater than `0`, THEN THE API SHALL return HTTP `400`.
4. WHEN a card is moved into a Column where `is_done = true`, THE API SHALL set `completed_at` to the current UTC timestamp.
5. WHEN a card is moved out of a Column where `is_done = true` into a Column where `is_done = false`, THE API SHALL clear `completed_at` to `null`.
6. THE API SHALL assign FLOAT `order` values using the same strategy as columns: append to end, insert between, insert at top, and rebalance when the gap drops below `1e-6`.
7. WHEN a card move request succeeds, THE Web SHALL update the card's position in the UI before the API response is received (optimistic update).
8. IF the card move API request fails, THEN THE Web SHALL restore the card to its original position and display an error toast.
9. WHILE the user is on a desktop browser, THE Web SHALL support moving cards via drag-and-drop using the `useDragAndDrop` hook.
10. THE Web SHALL provide a "Move to column" select in `CardDetailModal` that calls `PATCH /api/cards/<id>/position`, enabling card moves on mobile devices.

---

### REQ-10: Comments

**Reference:** F5

**User Story:** As a Member or Admin, I want to add, view, edit, and delete comments on cards, so that I can discuss task details with my team.

#### Acceptance Criteria

1. WHEN a Member or Admin sends `POST /api/cards/<card_id>/comments` with a `content` field (1–2,000 characters), THE API SHALL create a Comment with the requesting user as `author_id` and return HTTP `201`.
2. IF the submitted `content` is absent, fewer than 1 character, or greater than 2,000 characters, THEN THE API SHALL return HTTP `400`.
3. WHEN a Member or Admin sends `GET /api/cards/<card_id>/comments`, THE API SHALL return HTTP `200` with the list of non-deleted-card comments in chronological order.
4. WHEN the comment author sends `PATCH /api/comments/<id>` with updated `content`, THE API SHALL update the Comment and return HTTP `200`.
5. WHEN the comment author sends `DELETE /api/comments/<id>`, THE API SHALL delete the Comment and return HTTP `200` with `{ "data": { "id": "<uuid>" } }`.
6. IF a user who is not the comment author attempts to edit or delete a comment, THEN THE API SHALL return HTTP `403`.

---

### REQ-11: Notifications

**Reference:** F6, §5.7

**User Story:** As a logged-in user, I want to receive in-app notifications for key events, so that I stay informed about activity that involves me.

#### Acceptance Criteria

1. WHEN a card is assigned to a user, THE API SHALL create a Notification of type `card_assigned` for the new assignee, unless the assignee is the user who performed the action.
2. WHEN a comment is added to a card, THE API SHALL create Notifications of type `comment_added` for the card's creator and the card's current assignee, excluding the user who added the comment.
3. WHEN a user is added to a board, THE API SHALL create a Notification of type `board_invite` for the added user.
4. WHEN a logged-in user sends `GET /api/notifications`, THE API SHALL return HTTP `200` with a paginated list of that user's notifications in reverse chronological order, including an `unread_count` field.
5. THE API SHALL paginate notifications with a default `per_page` of `20` and a maximum of `100`.
6. WHEN a logged-in user sends `PATCH /api/notifications/<id>/read` to mark a notification as read, THE API SHALL set `is_read = true` and return HTTP `200`.
7. WHILE the user is logged in and the Web is open, THE Web SHALL poll `GET /api/notifications` every 30 seconds and update the `NotificationBell` unread count.

---

### REQ-12: My Tasks

**Reference:** F7, §5.1

**User Story:** As a logged-in user, I want to see all cards assigned to me in one place, so that I know what I need to work on.

#### Acceptance Criteria

1. WHEN a logged-in user sends `GET /api/cards?assignee=me`, THE API SHALL return HTTP `200` with all non-deleted cards assigned to the requesting user across all boards the user belongs to.
2. WHEN a logged-in user sends `GET /api/cards?assignee=me&board_id=<uuid>`, THE API SHALL return HTTP `200` with non-deleted cards assigned to the requesting user on the specified board only.
3. THE API SHALL never return soft-deleted cards from `GET /api/cards`.
4. THE Web SHALL display the My Tasks page as a list of non-deleted cards assigned to the current user, grouped by board name.

---

### REQ-13: Card Search

**Reference:** F8, §5.1

**User Story:** As a Member or Admin, I want to search for cards by title on the board page, so that I can quickly locate a specific task.

#### Acceptance Criteria

1. WHEN a logged-in user sends `GET /api/cards?board_id=<uuid>&q=<text>`, THE API SHALL return HTTP `200` with non-deleted cards on that board whose titles match the query using a case-insensitive `ILIKE` match.
2. THE Web SHALL debounce the search input by 300 milliseconds before sending `GET /api/cards?board_id=<uuid>&q=<text>`.
3. THE API SHALL restrict `GET /api/cards?board_id=<uuid>` results to boards the requesting user belongs to; IF the user is not a member of the specified board, THEN THE API SHALL return HTTP `404`.

---

### REQ-14: User Profile

**Reference:** F9

**User Story:** As a logged-in user, I want to view and update my name and email, so that my profile information stays current.

#### Acceptance Criteria

1. WHEN a logged-in user sends `GET /api/users/me`, THE API SHALL return HTTP `200` with `{ "data": { "id": "...", "name": "...", "email": "..." } }` and SHALL NOT include the password hash.
2. WHEN a logged-in user sends `PATCH /api/users/me` with a new `name` or `email`, THE API SHALL update the User record and return HTTP `200`.
3. IF the submitted `email` is already in use by another account, THEN THE API SHALL return HTTP `409`.
4. THE Web profile page SHALL pre-fill the name and email fields from AuthContext.
5. IF the submitted `PATCH /api/users/me` body includes a `password` field, THEN THE API SHALL return HTTP `400`.

---

### REQ-15: Board Analytics

**Reference:** F10, §5.5, §5.6

**User Story:** As an Admin, I want to view board analytics, so that I can monitor progress and team activity.

#### Acceptance Criteria

1. WHEN an Admin sends `GET /api/boards/<id>/analytics`, THE API SHALL return HTTP `200` with the total number of non-deleted cards per column.
2. WHEN an Admin sends `GET /api/boards/<id>/analytics`, THE API SHALL include the count of cards whose `completed_at` falls within the current ISO week (Monday 00:00 UTC to now) in the response.
3. WHEN an Admin sends `GET /api/boards/<id>/analytics`, THE API SHALL include per-member activity: the number of cards each member created on the board, the number of cards currently assigned to each member, and the number of comments each member wrote on the board in the last 7 days.
4. THE API SHALL compute analytics using SQLAlchemy joins in the service layer with no N+1 queries.
5. IF a Member (non-Admin) sends `GET /api/boards/<id>/analytics`, THEN THE API SHALL return HTTP `403`.

---

### REQ-16: Member Access Management

**Reference:** F11, §5.2

**User Story:** As an Admin, I want to add, remove, and change the role of board members, so that I can control who has access to the board.

#### Acceptance Criteria

1. WHEN an Admin sends `GET /api/boards/<id>/members`, THE API SHALL return HTTP `200` with the list of BoardMembers for that board.
2. WHEN an Admin sends `POST /api/boards/<id>/members` with an `email` and a `role`, THE API SHALL look up the user by email, add them as a BoardMember with the specified role, and return HTTP `201`.
3. IF the submitted `email` does not correspond to a registered user, THEN THE API SHALL return HTTP `404`.
4. IF the submitted `role` is not `"admin"` or `"member"`, THEN THE API SHALL return HTTP `400`.
5. WHEN an Admin sends `PATCH /api/boards/<id>/members/<user_id>` with a new `role`, THE API SHALL update the BoardMember's role and return HTTP `200`.
6. WHEN an Admin sends `DELETE /api/boards/<id>/members/<user_id>`, THE API SHALL remove the BoardMember and return HTTP `200` with `{ "data": { "id": "<uuid>" } }`.
7. IF an Admin attempts to remove the last remaining admin from a board, THEN THE API SHALL return HTTP `400` with `{ "error": "<message>" }`.
8. IF a Member (non-Admin) attempts any member management action, THEN THE API SHALL return HTTP `403`.

---

### REQ-17: API Response Envelope

**Reference:** §5.9

**User Story:** As a frontend developer, I want a consistent JSON response format from the API, so that the Web can handle all responses uniformly.

#### Acceptance Criteria

1. THE API SHALL wrap all successful responses in `{ "data": ... }`.
2. THE API SHALL wrap all error responses in `{ "error": "<human-readable message>" }`.
3. WHEN a resource is deleted, THE API SHALL return HTTP `200` with `{ "data": { "id": "<uuid>" } }` and SHALL NOT return HTTP `204`.
4. THE API SHALL format paginated responses as `{ "data": { "items": [...], "page": <int>, "per_page": <int>, "total": <int> } }` with a default `per_page` of `20` and a maximum of `100`.
5. THE API SHALL never return an HTML error page or a stack trace; IF an unhandled exception occurs in production, THEN THE API SHALL return a JSON error envelope with HTTP `500`.

---

### REQ-18: Security

**Reference:** NFR-1

**User Story:** As a system operator, I want the API to enforce authentication and authorisation consistently, so that user data is protected.

#### Acceptance Criteria

1. THE API SHALL hash all passwords before storage using Werkzeug's password hashing and SHALL NOT store or return passwords in plain text.
2. WHEN a JWT is issued on login, THE API SHALL set its expiry to 24 hours from the time of issue.
3. THE API SHALL enforce JWT authentication on every endpoint except `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/health`.
4. THE API SHALL enforce authorisation rules (role and ownership checks) in the service layer, not in route handlers.
5. THE API SHALL restrict CORS to origins listed in the `CORS_ORIGINS` environment variable.
6. THE API SHALL read all secrets (database URL, JWT secret key, CORS origins) from environment variables and SHALL NOT include secrets in source code.

---

### REQ-19: Performance

**Reference:** NFR-2

**User Story:** As a user, I want the board to load quickly and card moves to feel instant, so that my workflow is not interrupted.

#### Acceptance Criteria

1. WHEN a request is made to `GET /api/boards/<id>` on the production deployment for a board with up to 200 non-deleted cards, THE API SHALL respond within 500 milliseconds at the 95th percentile.
2. THE API SHALL use SQLAlchemy eager loading when fetching a board with its columns and cards to avoid N+1 queries.
3. WHEN a card move is initiated, THE Web SHALL update the card's position in the UI before the API response is received.

---

### REQ-20: Responsiveness

**Reference:** NFR-3

**User Story:** As a user on a mobile device, I want the app to be usable at small screen sizes, so that I can manage tasks on the go.

#### Acceptance Criteria

1. THE Web SHALL render every page without cut-off or overlapping content at a viewport width of 375 pixels.
2. WHILE the viewport is narrower than the full Kanban board width, THE Web SHALL allow horizontal scrolling on the `/boards/[id]` page.
3. THE Web SHALL render all interactive tap targets at a minimum size of 44 by 44 pixels.

---

### REQ-21: Reliability

**Reference:** NFR-4

**User Story:** As a user, I want the app to handle errors gracefully, so that I never lose work silently.

#### Acceptance Criteria

1. IF a card move API request fails, THEN THE Web SHALL restore the card to its original position and display an error toast.
2. THE API SHALL run with `debug = False` in the production configuration.
3. THE API SHALL always return responses in the JSON envelope format and SHALL NOT return raw HTML error pages or stack traces.

---

### REQ-22: Maintainability

**Reference:** NFR-5

**User Story:** As a developer, I want a consistent code structure, so that the codebase is easy to navigate and extend.

#### Acceptance Criteria

1. THE API SHALL organise each feature as a Flask Blueprint containing `routes.py` (HTTP handling only), `service.py` (business logic and queries), and `schema.py` (Marshmallow validation and serialisation).
2. THE Web SHALL reuse the shared components `BaseButton`, `BaseBadge`, and `BaseModal` for common UI patterns instead of creating one-off equivalents.
3. THE Web SHALL use TypeScript in strict mode with no use of the `any` type.

---

### REQ-23: Testability

**Reference:** NFR-6

**User Story:** As a developer, I want comprehensive automated tests, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE API SHALL have pytest test coverage for each blueprint's success path and for HTTP `400`, `401`, `403`, and `404` responses where those status codes apply.
2. THE Web E2E tests SHALL use `role` or `data-testid` selectors with web-first assertions.
3. THE Web E2E tests SHALL NOT use `waitForTimeout`.
4. THE Web E2E Playwright suite SHALL cover the four authentication scenarios: successful login redirects to `/`; invalid credentials show an error; unauthenticated visit to `/` redirects to `/login`; after logout, visiting `/` redirects to `/login`.
5. THE Web E2E Playwright suite SHALL cover the eight-step Kanban journey: log in; create a board; add a "To Do" column; add a "Done" column; create a card in "To Do"; drag the card to "Done"; reload the page; assert the card is still in "Done".

---

### REQ-24: Accessibility

**Reference:** NFR-7

**User Story:** As a user who relies on a keyboard or assistive technology, I want the app to be navigable without a mouse, so that I can use RevoTask effectively.

#### Acceptance Criteria

1. THE Web SHALL associate every form input with a visible label element.
2. WHEN a modal is open, THE Web SHALL close the modal when the Escape key is pressed and SHALL return focus to the element that triggered the modal.
3. THE Web SHALL convey status information in every badge using text in addition to colour, so that the information is not lost for users who cannot distinguish colours.

---

### REQ-25: Registration Page

**Reference:** F1, Appendix B (`/register`)

**User Story:** As a Guest, I want a registration form with client-side validation, so that I receive immediate feedback before my data is sent to the API.

#### Acceptance Criteria

1. THE `/register` page SHALL render all form inputs as controlled inputs whose values are managed by React state.
2. WHEN the user attempts to submit the registration form, THE `/register` page SHALL validate that the name field is not empty before sending any request to the API.
3. WHEN the user attempts to submit the registration form, THE `/register` page SHALL validate that the email field matches a valid email format before sending any request to the API.
4. WHEN the user attempts to submit the registration form, THE `/register` page SHALL validate that the password field meets the minimum required length before sending any request to the API.
5. WHEN client-side validation fails on a field, THE `/register` page SHALL display an inline error message for each failing field without submitting the form.
6. WHEN all client-side validation passes, THE `/register` page SHALL submit the form by sending `POST /api/auth/register` with the name, email, and password.
7. IF the API returns an error response, THEN THE `/register` page SHALL display the error message from the `{ "error": "..." }` envelope to the user.

---

### REQ-26: Dashboard Page

**Reference:** F2, Appendix B (`/`)

**User Story:** As a logged-in user, I want a dashboard that lists my boards and lets me create new ones, so that I can navigate my work quickly.

#### Acceptance Criteria

1. THE `/` dashboard page SHALL be implemented as a Next.js Server Component.
2. WHEN the `/` dashboard page renders, THE `/` dashboard page SHALL fetch the user's boards by calling `GET /api/boards` on the server before the page is sent to the client.
3. WHEN the user has at least one board, THE `/` dashboard page SHALL render a list of those boards.
4. WHEN the user has no boards, THE `/` dashboard page SHALL render an empty state that communicates that no boards exist yet.
5. THE `/` dashboard page SHALL provide a create-board action that sends `POST /api/boards` to create a new board.

---

### REQ-27: Board Detail Page

**Reference:** F3, F4, F8, Appendix B (`/boards/[id]`)

**User Story:** As a Member or Admin, I want the board page to display columns and cards in order and support adding columns and cards, so that I can manage work visually.

#### Acceptance Criteria

1. THE `/boards/[id]` page SHALL be implemented as a Next.js Server Component with client-side islands for interactive features.
2. WHEN the `/boards/[id]` page renders, THE `/boards/[id]` page SHALL display columns sorted in ascending `order`.
3. WHEN the `/boards/[id]` page renders, THE `/boards/[id]` page SHALL display each column's non-deleted cards sorted in ascending `order`.
4. THE `/boards/[id]` page SHALL provide an add-column action that sends `POST /api/boards/<id>/columns` with a column name.
5. THE `/boards/[id]` page SHALL provide a per-column add-card action that sends `POST /api/columns/<id>/cards` with at minimum a card title.
6. WHEN a card search query is active, THE `/boards/[id]` page SHALL render only the cards whose titles match the query, hiding non-matching cards in place without removing their columns.
7. WHEN a user clicks a card, THE `/boards/[id]` page SHALL open `CardDetailModal` for that card.

---

### REQ-28: Card Detail Modal

**Reference:** F4, F5, Appendix B (`CardDetailModal.tsx`)

**User Story:** As a Member or Admin, I want a card detail modal that lets me edit the card and manage comments, so that all card-related actions are accessible in one place.

#### Acceptance Criteria

1. THE `CardDetailModal` component SHALL be rendered inside `BaseModal`.
2. THE `CardDetailModal` component SHALL display editable fields for the card's title, description, assignee, due date, and priority.
3. WHEN a user edits one or more card fields and confirms the change, THE `CardDetailModal` component SHALL send `PATCH /api/cards/<id>` with the updated fields.
4. THE `CardDetailModal` component SHALL compose the `CommentList` component, which displays existing comments for the card in chronological order.
5. THE `CardDetailModal` component SHALL include a comment form that sends `POST /api/cards/<id>/comments` when submitted.
6. WHEN the current user is the author of a comment, THE `CommentList` component SHALL display inline edit and delete controls for that comment.
7. WHEN the current user is not the author of a comment, THE `CommentList` component SHALL NOT display edit or delete controls for that comment.
8. WHEN a user edits their own comment and confirms the change, THE `CommentList` component SHALL send `PATCH /api/comments/<id>` with the updated content.
9. WHEN a user deletes their own comment, THE `CommentList` component SHALL send `DELETE /api/comments/<id>`.

---

### REQ-29: Header Component

**Reference:** F6, Appendix B (Header)

**User Story:** As a logged-in user, I want the header to show navigation links, my notification count, and a logout control, so that I can move between pages and act on key information from anywhere.

#### Acceptance Criteria

1. THE `Header` component SHALL render navigation links to the application's main pages.
2. THE `Header` component SHALL render the `NotificationBell` component, which displays the current unread notification count sourced from the `useNotifications` hook.
3. THE `Header` component SHALL render a logout control that, when activated, executes the logout action described in REQ-4.3.

---

### REQ-30: useErrorHandler Hook

**Reference:** Appendix B (`hooks/useErrorHandler.ts`)

**User Story:** As a developer, I want a centralised error handler hook that maps API errors to user-facing messages, so that every component shows consistent feedback without duplicating error-handling logic.

#### Acceptance Criteria

1. THE `useErrorHandler` hook SHALL accept an `ApiError` and map its `statusCode` to a user-facing action.
2. WHEN the `ApiError` has status code `400`, THE `useErrorHandler` hook SHALL call `lib/toast` to display the validation message from the error envelope.
3. WHEN the `ApiError` has status code `401`, THE `useErrorHandler` hook SHALL call `lib/toast` to display "session expired", clear the `revotask_token` cookie, clear AuthContext, and redirect the user to `/login`.
4. WHEN the `ApiError` has status code `403`, THE `useErrorHandler` hook SHALL call `lib/toast` to display "not allowed".
5. WHEN the `ApiError` has status code `404`, THE `useErrorHandler` hook SHALL call `lib/toast` to display "not found".
6. WHEN the `ApiError` has status code `409`, THE `useErrorHandler` hook SHALL call `lib/toast` to display the conflict message from the error envelope.
7. WHEN the `ApiError` has a status code in the range `500`–`599`, THE `useErrorHandler` hook SHALL call `lib/toast` to display a generic error message.

---

### REQ-31: lib/apiClient Module

**Reference:** Appendix B (`lib/apiClient.ts`)

**User Story:** As a developer, I want a typed fetch wrapper that handles base URLs, authentication headers, and error normalisation, so that all API calls follow a consistent pattern.

#### Acceptance Criteria

1. WHEN `lib/apiClient` is used in a Client Component, THE `lib/apiClient` module SHALL read the API base URL from the `NEXT_PUBLIC_API_BASE_URL` environment variable.
2. WHEN `lib/apiClient` is used in a Server Component, THE `lib/apiClient` module SHALL read the API base URL from the `API_BASE_URL` environment variable.
3. WHEN a JWT token is available, THE `lib/apiClient` module SHALL attach an `Authorization: Bearer <token>` header to every outgoing request.
4. WHEN an API response has a non-2xx HTTP status code, THE `lib/apiClient` module SHALL throw an `ApiError` (defined in `lib/errors`) populated with the `statusCode` from the HTTP response and the `message` from the `{ "error": "..." }` envelope.

---

### REQ-32: Shared UI Components

**Reference:** Appendix B (`components/shared`)

**User Story:** As a developer, I want standardised shared components that enforce consistent styling variants, so that the UI is cohesive and new screens can be built without one-off elements.

#### Acceptance Criteria

1. THE `BaseButton` component SHALL support a `variant` prop with the values `primary`, `secondary`, and `destructive`, and SHALL render distinct visual styles for each variant.
2. THE `BaseBadge` component SHALL support color variants corresponding to the card priority values `low`, `medium`, and `high`.
3. THE `/my-tasks` page SHALL use `BaseButton` for every button element and SHALL NOT introduce one-off button elements.
4. THE `/profile` page SHALL use `BaseButton` for every button element and SHALL NOT introduce one-off button elements.
