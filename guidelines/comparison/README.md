# Guideline Comparison — AI Output Before and After

This document compares AI-generated code for the same task, produced once **without** the steering guidelines and once **with** them. It is the "documented comparison showing measurable improvement" for the `/guidelines` folder.

| Field | Value |
| ----- | ----- |
| Date | 2026-11-27 |
| Task | Implement the `comments` blueprint: `routes.py`, `service.py`, `schema.py` |
| Tool | Claude Code, two separate sub-agents, each started with an empty context |
| Before | [`before/comments/`](before/comments/): the agent received the task brief only |
| After | [`after/comments/`](after/comments/): the agent received the same brief and was told to read `guidelines/backend.md` and `guidelines/database.md` first |
| Reviewed by | Manual read of both outputs against every `BE-xx` and `DB-xx` guideline |

## Method

1. Both agents got an **identical task brief**: the four comment endpoints, the behavior rules (400 / 401 / 403 / 404, soft-deleted card, chronological order, notify creator and assignee but not the commenter, JSON envelope) and the list of available models with their fields.
2. Both were forbidden to read anything else in the repository, so neither could copy from the specs or from the other's output.
3. The only difference: the "after" agent had to read the two guideline files and was told that helpers named there exist.
4. Neither output was edited. The files in `before/` and `after/` are exactly what the agents wrote.
5. Each output was then checked against each guideline, and every violation was recorded with its file and line.

## Result

| Metric | Before (no guidelines) | After (with guidelines) |
| ------ | ---------------------- | ----------------------- |
| Guidelines violated (of the 20 `BE` + `DB` rules) | **7** | **1** |
| Violation instances | **13** | **1** |
| Lines of code (3 files) | 240 | 142 |
| Error-response code paths inside the blueprint | 3 (own exception class + 2 local handlers) | 0 (central `AppError` handler) |
| Places that build a `Notification` row directly | 1 | 0 |
| Behavior added that the brief did not ask for | 2 | 0 |

Both versions implement the requested behavior. The baseline is not broken code; its problems are that it **re-invents project infrastructure locally**. In a codebase with eight blueprints, that means eight slightly different copies of the same thing.

## Violations in the "before" output

| # | Guideline | File and lines | What the code does |
| - | --------- | -------------- | ------------------ |
| 1 | BE-02 (envelope helpers) | `routes.py` 39, 46, 54, 61 | Four success responses built with `jsonify({"data": ...})` directly, with no shared `success()` helper |
| 2 | BE-03 (`AppError`, no error handling in routes) | `service.py` 9–13 | Defines its own `CommentError` exception class |
| 3 | BE-03 | `routes.py` 11–13 | Blueprint-level error handler that builds the error response for `CommentError` |
| 4 | BE-03 | `routes.py` 16–24 | A second blueprint-level handler that re-implements `ValidationError` → `400` |
| 5 | BE-04 (validate with schemas, not by hand) | `routes.py` 27–31 | Hand-written check that the body is a JSON object, raising a `400` from the route |
| 6 | BE-04 | `service.py` 20–26 | Hand-written UUID parsing (`_to_uuid`), used for card, comment and user IDs, instead of typed URL converters |
| 7 | BE-06 (shared `require_member`) | `service.py` 36–46 | Membership is checked with a private three-table join written inside this blueprint |
| 8 | BE-07 (`current_user_id()` helper) | `service.py` 75–79, 86–88 | The raw JWT identity is passed into the service, which parses it and raises `401` itself |
| 9 | BE-09 (side effects through the owning service) | `service.py` 95–103 | Builds `Notification(...)` rows directly instead of calling `notifications.service.create_notification` |
| 10 | DB-04 (`active_cards()` helper) | `service.py` 42 | Filters `Card.deleted_at.is_(None)` by hand |

Rows 1 and 6 count as 4 and 1 instances respectively, which gives the total of 13 instances across 7 guidelines (BE-02, BE-03, BE-04, BE-06, BE-07, BE-09, DB-04).

**Behavior the brief did not ask for** (not guideline violations, but worth noticing in review):

- `schema.py` 20–24 strips whitespace from `content` before validating, so a comment of only spaces becomes a `400`. No requirement says this.
- `schema.py` 5–6 sets `unknown = EXCLUDE`, which silently ignores unexpected fields instead of rejecting them.

## Violations in the "after" output

| # | Guideline | File and lines | What the code does |
| - | --------- | -------------- | ------------------ |
| 1 | DB-04 (`active_cards()` helper) | `service.py` 26 | `get_comment_for_member` filters `Card.deleted_at.is_(None)` by hand inside a `Comment` query. `get_card_for_member` (line 13) does use `active_cards()`. |

Everything else follows the guidelines:

- routes contain only load → service → `success(...)` (BE-01, BE-02, BE-04);
- errors are raised as `AppError` with no handler in the blueprint (BE-03);
- membership goes through `require_member` (BE-06);
- identity comes from `current_user_id()` (BE-07);
- notifications go through `notifications.create_notification` (BE-09);
- each operation commits once (DB-08).

## What the comparison showed about the guidelines themselves

The "after" agent reported that it had to **guess three import paths**, because the guidelines named the helpers but never said where they live:

| Helper | Path the agent guessed | Path in the accepted `tasks.md` |
| ------ | ---------------------- | ------------------------------- |
| `AppError` | `app.utils.errors` | `app/exceptions.py` (a mismatch) |
| `current_user_id`, `require_member` | `app.utils.auth` | not specified anywhere |
| `active_cards` | `app.models.card` | shown in DB-04's example |

A guessed path that differs between blueprints is exactly the drift the guidelines exist to prevent. **Fix applied:** guideline **BE-11** was added to `backend.md`. It fixes the location of every shared helper and forbids redefining one inside a blueprint.

The remaining DB-04 violation also showed that the rule was unclear for queries that *join* to cards from another model. The DB-04 text was left as is. The case is handled in code review, and it will be listed in the violation report if it appears in the real implementation.

## Limits of this comparison

- One run per condition (n = 1). Another run could produce a different count.
- Several baseline violations are convention mismatches, not bugs: an agent that has never been told `success()` exists cannot call it. That is the point of steering guidelines, but it means the numbers measure **consistency with this project**, not general code quality.
- Only backend and database guidelines were exercised. The frontend guidelines are checked during implementation, and violations found there go into the violation report.
