# Changelog — Specification Refinement

This log records each refinement round applied to AI-generated specification documents. Every entry contains:

- **Trigger**: what the review found
- **Fix**: the targeted prompt or edit that was applied
- **Before / After**: the text as it was and as it is now
- **Review of the result**: what was checked, including anything the AI did that was not asked for

Raw AI output is committed **before** each refinement, so every entry can be verified with `git diff`.

| Entry | Artifact | Round | Tool | Summary |
| ----- | -------- | ----- | ---- | ------- |
| [CL-01](#cl-01) | `specs/project-brief.md` | Brief v0.1 → v0.2 | Claude Code | Added the canonical endpoint catalog and the required frontend behaviors |
| [CL-02](#cl-02) | `requirements.md` | R1 | Kiro (Spec) | Aligned 5 endpoint paths with the assignment; added the column reorder endpoint |
| [CL-03](#cl-03) | `requirements.md` | R2 | Kiro (Spec) | Added 8 frontend requirements (46 criteria) for pages, hooks, `lib/` and shared components |
| [CL-04](#cl-04) | `requirements.md` | R3 | Kiro (Spec) | Added 10 missing criteria required by the assignment (validation, 401/404/409 cases, pagination) |
| [CL-05](#cl-05) | `requirements.md` | R4 | Kiro (Spec) | Fixed a self-contradicting trigger, untestable wording, empty-list edge cases and an invalid reference |
| [CL-06](#cl-06) | `requirements.md` | R5 | Kiro (Spec) | Removed 5 duplicated criteria; NFR requirements now reference the feature criteria |
| [CL-07](#cl-07) | `requirements.md` | R6 | Kiro (Spec) | Closed 9 gaps found while reviewing R2; requirements accepted (32 REQs, 187 criteria) |
| [CL-08](#cl-08) | `design.md` | DR2 | Kiro (Spec) | Defined response (dump) schemas; position/reorder responses carry rebalance info; tightened query and order validation |
| [CL-09](#cl-09) | `design.md` | DR1 | Kiro (Spec) | Fixed 8 blockers: error handlers, JWT error envelope, notification FK cascade, middleware location, Header on auth pages, repo roots, soft-delete eager loading |
| [CL-10](#cl-10) | `design.md` | DR3 | Kiro (Spec) | Timezone-aware timestamps, FK indexes, `Column` → `BoardColumn`, Railway URL normalization, frontend `.env.example` |
| [CL-11](#cl-11) | `design.md` | DR4 | Kiro (Spec) | Per-criterion traceability table, missing form components, `AppError` pattern, test-strategy and reference fixes |
| [CL-12](#cl-12) | `design.md` | DR5 | Kiro (Spec) | Mapped the last unmapped criterion (REQ-2.6); design accepted with 187/187 criteria traced |
| [CL-13](#cl-13) | `tasks.md` | TR1 | Claude Code | Removed 2 invented behaviors, fixed a build-breaking module, the test database and the CORS setup |
| [CL-14](#cl-14) | `tasks.md` | TR2 | Claude Code | Added test tooling setup, guideline and deliverable tasks, a performance check; all 187 criteria now referenced; tasks accepted |

---

## CL-01

**Brief v0.1 → v0.2: add the canonical endpoint catalog and the frontend behaviors**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `specs/project-brief.md` |
| Tool | Claude Code (the author reviewed and approved the edit) |
| Trigger | Review of Kiro `requirements.md` v1 ([review](reviews/requirements-v1-review.md), findings #1–#6) |
| Commits | before `f9f70a7` → after `e1d6c21` |

**Trigger.** Kiro's first `requirements.md` invented 5 endpoint paths and under-specified the frontend. That was the brief's fault, not Kiro's: v0.1 never listed the assignment's exact routes or page behaviors, so Kiro had nothing to anchor them to.

**Before (v0.1, §4).**

> F3 | Column management | Add, rename, delete, and reorder columns using a FLOAT `order` value.

No method or path appeared anywhere in the brief. The frontend was only described in a page table (§9) with one-line purposes.

**After (v0.2).**

- **Appendix A**: 30 endpoints, each with its exact method, path, purpose and source (assignment or §5 decision). It also carries an explicit rule: "Generated specs and code must use these exact paths."
- **Appendix B**: 15 required frontend behaviors (pages, shared components, hooks, `lib/` modules), each stated so it can be turned into an acceptance criterion.

**Effect.** This gave the refinement prompts a single source to point at. R1 ([CL-02](#cl-02)) used it to fix every path.

---

## CL-02

**Requirements R1: align the endpoint paths with the assignment**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/requirements.md` |
| Tool | Kiro, Spec mode |
| Trigger | Review findings #1–#5 |
| Prompt | R1 in [requirements-v1-review.md](reviews/requirements-v1-review.md#r1--endpoint-paths) |
| Commits | before `fae19ee` → after `c66acec` |

**Trigger.** Five criteria used paths that contradict the assignment, and the column reorder endpoint was missing because Kiro had folded reordering into the column `PATCH`.

**Before → After.**

| Criterion | Before | After |
| --------- | ------ | ----- |
| REQ-6.2 | `PATCH /api/boards/<id>/columns/<col_id>` with a new name or a new `order` | `PATCH /api/columns/<id>` with a new name or `is_done` value |
| REQ-6.3 | `DELETE /api/boards/<id>/columns/<col_id>` | `DELETE /api/columns/<id>` |
| REQ-6.7 | *(missing)* | **New:** `PATCH /api/boards/<id>/columns/reorder` with `column_id` (a UUID of a column on that board) and `order` (float > 0) |
| REQ-10.4 | `PATCH /api/cards/<card_id>/comments/<comment_id>` | `PATCH /api/comments/<id>` |
| REQ-10.5 | `DELETE /api/cards/<card_id>/comments/<comment_id>` | `DELETE /api/comments/<id>` |
| REQ-11.6 | `PATCH /api/notifications/<id>` | `PATCH /api/notifications/<id>/read` |
| REQ-14.5 | *(missing)* | **New (not requested in this round):** IF the `PATCH /api/users/me` body includes `password`, THEN `400` |

**Review of the result.**

- **Verified.** A script extracted every method-and-path pair from `requirements.md` and compared it with Appendix A: all 30 match. The only differences are path-parameter names (`<card_id>` and `<col_id>` instead of `<id>`), which do not change the URL.
- **Accepted side change.** In REQ-6.2, Kiro replaced "a new `order`" with "`is_done` value". This is correct: ordering now has its own reorder endpoint, and Appendix A assigns `is_done` to this one.
- **Edit outside the requested scope.** The prompt said "change only these items" and asked Kiro to *report*, not fix, any other mismatch. Kiro instead added REQ-14.5. The content is correct (it matches Appendix A), so it was kept, but it is logged as a prompt-adherence issue. Every later prompt now says explicitly: "Report other problems at the end; do not fix them."
- **New gap.** REQ-6.7 has no error criteria (a `column_id` from another board, or `order` ≤ 0). It was added to the R3 prompt.

---

## CL-03

**Requirements R2: add frontend coverage**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/requirements.md` |
| Tool | Kiro, Spec mode |
| Trigger | Review finding #6 |
| Prompt | R2 in [requirements-v1-review.md](reviews/requirements-v1-review.md#r2--frontend-coverage) |
| Commits | before `c66acec` → after `b968ca0` |

**Trigger.** The requirements had 90 API criteria but only 24 Web criteria, and most of the Web ones were NFRs. Nothing covered the Dashboard, the Board Detail rendering, the comment UI in `CardDetailModal`, Register validation, `useErrorHandler`, `apiClient` or the shared components. As a result, `design.md` would have had no acceptance criteria to map to the Next.js pages, which the rubric requires.

**Before.** None of the following existed: REQ-25 to REQ-32, and any criterion for `/register` validation, `/` Dashboard, `/boards/[id]` rendering, `CardDetailModal` comments, `Header`, `useErrorHandler`, `lib/apiClient`, `BaseButton` variants or `BaseBadge` variants.

**After.** Eight new requirements with 46 criteria, each naming the page, component, hook or lib file it applies to:

| New REQ | Covers | Criteria |
| ------- | ------ | -------- |
| REQ-25 | `/register`: controlled inputs, client-side validation, inline errors, API error display | 7 |
| REQ-26 | `/` Dashboard: Server Component, `GET /api/boards`, list, empty state, create board | 5 |
| REQ-27 | `/boards/[id]`: Server Component with client islands, columns and cards in `order`, add column, add card, search display, open modal | 7 |
| REQ-28 | `CardDetailModal` in `BaseModal`: edit fields, `CommentList`, add comment, owner-only edit and delete controls | 9 |
| REQ-29 | `Header`: navigation, `NotificationBell` via `useNotifications`, logout | 3 |
| REQ-30 | `useErrorHandler`: 400 / 401 / 403 / 404 / 409 / 5xx mapped to toasts; 401 also clears the token and redirects | 7 |
| REQ-31 | `lib/apiClient`: env-based base URL for client and server, Bearer header, throws `ApiError` | 4 |
| REQ-32 | `BaseButton` and `BaseBadge` variants; My Tasks and Profile use `BaseButton` | 4 |

Example, REQ-28.6 and 28.7 (new):

> WHEN the current user is the author of a comment, THE `CommentList` component SHALL display inline edit and delete controls for that comment.
> WHEN the current user is not the author of a comment, THE `CommentList` component SHALL NOT display edit or delete controls for that comment.

**Review of the result.**

- **Scope respected.** `git diff` shows only appended lines (134 additions, 0 deletions). The tighter "report, don't fix" wording added after [CL-02](#cl-02) worked.
- **The AI's self-check is not reliable.** Kiro closed the round with "No other problems found", but the manual review below found nine (#20–#28), including a conflict between two requirements. Its self-assessment is treated as a claim to verify, not as a review.
- **Coverage.** 13 of the 15 Appendix B items are covered. `BaseModal` as the wrapper for all forms is missing (finding #22), and `lib/toast` has no criterion of its own (#28).
- **New problems found during review (#20–#28):**
  - **#20 Untestable criterion.** REQ-25.4 says "the minimum required length" without a number, and the API does not enforce any length.
  - **#21 Missing failure UI.** A failed login has no Web criterion, even though Playwright auth scenario 2 depends on it.
  - **#23 Endpoint with no consumer.** `PATCH /api/notifications/<id>/read` has no UI that calls it.
  - **#24 Conflicting requirements.** The assignee picker (REQ-28.2) needs `GET /members`, but REQ-16 makes that admin-only, so a regular member could never assign a card. Neither requirement is wrong alone; the conflict only shows when the two are read together.
- **Root cause and fix.** Findings #20, #23 and #24 trace back to gaps in the brief, so the brief was updated to **v0.3** first: password at least 8 characters on both client and API, `GET /members` readable by any member, and a `NotificationBell` list with click-to-mark-read. All nine findings are then addressed by refinement round **R6**.

---

## CL-04

**Requirements R3: add the missing criteria the assignment requires**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/requirements.md` |
| Tool | Kiro, Spec mode |
| Trigger | Review findings #8–#12, #19 |
| Prompt | R3 in [requirements-v1-review.md](reviews/requirements-v1-review.md#r3--missing-criteria-required-by-the-assignment) |
| Commits | before `b968ca0` → after `8f48bfb` |

**Trigger.** Some behaviors the assignment or rubric require explicitly had no acceptance criterion:

- the `page` and `per_page` parameters for notifications
- validation through `CardPositionSchema`
- `401` on comment endpoints (the rubric's comment tests require 201, 400, 401 and 403)
- error cases for the reorder endpoint added in R1
- duplicate-member and last-admin protection

A behavior without a criterion has no test, so these would have been missed in `tasks.md` and pytest.

**Before → After.**

| Criterion | Before | After |
| --------- | ------ | ----- |
| REQ-6.8 | *(missing)* | IF the reorder `column_id` is not a valid UUID or not a column on that board, THEN `400` |
| REQ-6.9 | *(missing)* | IF the reorder `order` is not a float > 0, THEN `400` |
| REQ-9.11 | `CardPositionSchema` not named; malformed UUID unhandled | Body validated with `CardPositionSchema`; IF `column_id` is not a valid UUID, THEN `400` |
| REQ-10.7 | *(missing)* | IF any comment endpoint is called without a valid JWT, THEN `401` |
| REQ-10.8 | *(missing)* | IF the user is not a member of the card's board, THEN `404` |
| REQ-11.8 | Pagination mentioned without its parameters | `GET /api/notifications` reads the `page` and `per_page` query parameters |
| REQ-11.9 | *(missing)* | IF `page` < 1 or `per_page` is not an integer from 1 to 100, THEN `400` |
| REQ-11.10 | *(missing)* | IF a user marks another user's notification as read, THEN `404` |
| REQ-16.9 | *(missing)* | IF the email already belongs to a member of the board, THEN `409` |
| REQ-16.10 | *(missing)* | IF a role change via `PATCH` would leave the board with no admin, THEN `400` |

**Review of the result.**

- **Complete.** All 7 requested items were applied.
- **Scope respected.** The diff has 10 additions and 0 deletions, and no existing criterion was renumbered or reworded.
- **Rubric check.** REQ-10 now specifies every status code the rubric's comment tests need: `201` (10.1), `400` (10.2), `401` (10.7) and `403` (10.6), plus `404` for non-members (10.8).
- **Improvement over the prompt.** For REQ-16.10 the prompt said "demotes the last remaining admin"; Kiro wrote "a role that would leave the board with no remaining admin", which covers the same case more precisely. Accepted.
- **Gap in our own prompt (finding #29).** The prompt only said "page < 1", so `?page=abc` is still undefined. This was the author's mistake, not Kiro's, and it is fixed in R4.

---

## CL-05

**Requirements R4: fix logic and testability defects**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/requirements.md` |
| Tool | Kiro, Spec mode |
| Trigger | Review findings #13–#17, #29 |
| Prompt | R4 in [requirements-v1-review.md](reviews/requirements-v1-review.md#r4--logic-and-testability-defects) |
| Commits | before `8f48bfb` → after `54708f4` |

**Trigger.** Some criteria existed but could not be implemented or tested as written. One contradicted itself, some were vague, two broke on an empty list, and one pointed at a feature ID that does not exist.

**Before → After.**

| Criterion | Before | After | Defect |
| --------- | ------ | ----- | ------ |
| REQ-9.7 | WHEN a card move request **succeeds**, THE Web SHALL update the UI **before the API response is received** | WHEN **the user drops a card on a column**, THE Web SHALL update the UI before the API response is received | Self-contradiction: success is only known *after* the response |
| REQ-1.2 | IF the database is unreachable, THEN return **a non-`200` status code** | … THEN return HTTP **`503`** with `{ "error": "database unavailable" }` | Untestable: a test needs an exact code |
| REQ-6.1 | Column `order` = last column's order + 1024 | `1024` if the board has no columns, otherwise last + 1024 | Undefined for an empty board |
| REQ-7.1 | Card `order` = last card's order + 1024 | `1024` if the column has no cards, otherwise last + 1024 | Undefined for an empty column |
| REQ-10.3 | "the list of **non-deleted-card comments**" | "the card's comments in chronological order; IF the card is soft-deleted, THEN `404`" | Ambiguous wording |
| REQ-11.9 | IF `page` is **less than 1** … | IF `page` is **not an integer ≥ 1** … | `?page=abc` was undefined (a gap in our own R3 prompt) |
| REQ-1 reference | `F — Infrastructure (§5.3)` | `§5.3, NFR-4` | "F — Infrastructure" is not a valid feature ID |

**Review of the result.**

- **Complete and scoped.** All 6 items were applied. The diff rewrites exactly 7 lines and touches nothing else.
- **Why REQ-9.7 matters.** Written as before, the optimistic update could only run after the API had succeeded, which is the opposite of optimistic. `useDragAndDrop` and its test would have been built on a contradiction.
- **Minor style note, accepted.** For REQ-10.3 the prompt said "add" a `404` rule, and Kiro merged it into the same criterion instead of appending a new one. The behavior is the same and numbering is preserved.
- **Still open.** REQ-9.7 is still duplicated by REQ-19.3. That is intentional; R5 handles all duplicates together.

---

## CL-06

**Requirements R5: remove duplicated criteria**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/requirements.md` |
| Tool | Kiro, Spec mode |
| Trigger | Review finding #18 |
| Prompt | R5 in [requirements-v1-review.md](reviews/requirements-v1-review.md#r5--duplicated-criteria) |
| Commits | before `54708f4` → after `6c513c3` |

**Trigger.** Five behaviors were specified twice, once in a feature requirement and once in an NFR requirement. Each duplicate would get its own test, and the two copies could drift apart. This had already happened once: R4 fixed the trigger in REQ-9.7 but left the older wording in REQ-19.3.

**Before → After.**

| Criterion | Before (duplicate) | After | Single source |
| --------- | ------------------ | ----- | ------------- |
| REQ-18.1 | THE API SHALL hash all passwords … using Werkzeug's password hashing and SHALL NOT store or return passwords in plain text | Covered by REQ-2.4 | REQ-2.1, 2.4 |
| REQ-18.3 | THE API SHALL enforce JWT authentication on every endpoint except register, login and health | Covered by REQ-4.2 | REQ-4.2 |
| REQ-19.3 | WHEN a card move is initiated, THE Web SHALL update the UI before the API response | Covered by REQ-9.7 | REQ-9.7 |
| REQ-21.1 | IF a card move API request fails, THEN restore the card and show an error toast | Covered by REQ-9.8 | REQ-9.8 |
| REQ-21.3 | THE API SHALL always return the JSON envelope and never raw HTML errors or stack traces | Covered by REQ-17.5 | REQ-17.5 |

**Review of the result.**

- **Complete and scoped.** The diff rewrites exactly 5 lines, and numbering is preserved, so existing references still resolve.
- **References checked.** Each "Covered by" target was read and holds the full behavior: REQ-2.1 and 2.4 (hash, no plain text), REQ-4.2 (the same three public endpoints), REQ-9.7 and 9.8 (optimistic update, then rollback with a toast) and REQ-17.5 (no HTML errors, JSON `500`).
- **Information lost, now tracked.** The removed REQ-18.1 was the only place in the requirements that named **Werkzeug** as the hashing library. That is an implementation choice, so it belongs in `design.md`, not here. It is added to the design review checklist so it does not silently disappear.
- **Result.** Each behavior now has exactly one criterion, so each gets exactly one test in `tasks.md`.

---

## CL-07

**Requirements R6: close the gaps found while reviewing R2, and accept the requirements**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/requirements.md` |
| Tool | Kiro, Spec mode |
| Trigger | Review findings #20–#28, after brief v0.3 |
| Prompt | R6 in [requirements-v1-review.md](reviews/requirements-v1-review.md#r6--gaps-found-while-reviewing-r2) |
| Commits | before `6c513c3` → after `09f64ad` |

**Trigger.** Reviewing R2 surfaced 9 more gaps:

- an untestable password rule
- no UI for a failed login
- an endpoint with no consumer (`/read`)
- a conflict between the assignee picker and admin-only `GET /members`
- missing `BaseModal`, `lib/toast` and Profile criteria
- vague navigation and search wording

**Before → After.**

| Criterion | Before | After |
| --------- | ------ | ----- |
| REQ-25.4 | password "meets the minimum required length" | password "is at least 8 characters long" |
| REQ-2.6 | *(missing)* | IF the password is shorter than 8 characters, THEN `400`. Client and API now agree |
| REQ-3.6 | *(missing)* | IF login fails, THEN `/login` shows the envelope error and stays on `/login` |
| REQ-16.1 | WHEN **an Admin** sends `GET /members` | WHEN **any Member or Admin** sends `GET /members` |
| REQ-16.8 | Non-admin → `403` on "any member management action" | Non-admin → `403` on `POST`, `PATCH`, `DELETE` members only |
| REQ-29.1 | links to "the application's main pages" | links to Dashboard `/`, My Tasks `/my-tasks`, Profile `/profile` |
| REQ-29.4–29.5 | *(missing)* | `NotificationBell` lists the latest notifications; clicking an unread one calls `PATCH …/read` and lowers the count |
| REQ-32.5 | *(missing)* | `BaseModal` wraps every form: create board, add column, add card, `CardDetailModal` |
| REQ-14.6–14.8 | *(missing)* | `/profile`: controlled inputs, `PATCH /api/users/me`, success toast via `lib/toast` |
| REQ-27.6 | "render only the cards whose titles match" (source unclear) | fetch from `GET /api/cards?board_id=&q=` (REQ-13) and render the returned cards |
| REQ-9.9 | drag-and-drop "using the `useDragAndDrop` hook" | "via the native HTML5 Drag and Drop API, implemented in `useDragAndDrop`" |
| REQ-31.5 | *(missing)* | `lib/toast` exposes `success`, `error` and `loading` wrapping react-hot-toast |
| REQ-12.5 | *(missing)* | `/my-tasks` shows each card's priority with `BaseBadge` |

**Review of the result.**

- **Complete.** All 11 prompt items were applied: 16 additions and 6 in-place rewrites.
- **In-place rewrites checked.** The prompt said to append, but REQ-16.1, 16.8, 29.1, 27.6 and 9.9 were rewritten in place. Each rewrite is the requested fix itself. Appending would have left the old wording contradicting the new one (for example "WHEN an Admin" next to "any Member"). Accepted.
- **Conflict #24 resolved.** A regular member can now load the member list for the assignee picker, while add, change and remove stay admin-only.
- **Final checks before acceptance:**
  - 32 requirements, 187 acceptance criteria (up from 119 in v1). A script confirmed that every requirement has at least one criterion.
  - All 30 endpoint paths match brief Appendix A ([CL-02](#cl-02)).
  - Every Appendix B frontend item now has a criterion naming its page, component, hook or lib file.
  - The rubric's comment-test status codes are all specified: `201` (10.1), `400` (10.2), `401` (10.7), `403` (10.6).

**Status: requirements accepted.** The next phase is `design.md` (Kiro: Generate Tech Design). The design review must check that Werkzeug is named as the hashing library (see [CL-06](#cl-06)).

---

## CL-08

**Design DR2: define the API response contract**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/design.md` |
| Tool | Kiro, Spec mode |
| Trigger | Design review findings D9–D13 ([design-v1-review.md](reviews/design-v1-review.md)) |
| Prompt | DR2 in [design-v1-review.md](reviews/design-v1-review.md#dr2--api-contract) |
| Commits | before `0937b45` (raw design v1) → after `1048724` |

**Trigger.** Design v1 defined only *input* schemas. Every response body was written as "card fields…", "comment fields…" and so on. Two pages could not be built from that contract:

- `/my-tasks` must group by board **name** (REQ-12.4), but cards carried no board name.
- `CommentList` must show who wrote each comment, but comments only had `author_id`.

The FLOAT rebalance also had a client-side flaw: after a server rebalance, the browser kept stale `order` values for every other card.

**Before → After.**

| Area | Before | After |
| ---- | ------ | ----- |
| Response bodies | `{ "data": { card fields... } }` and similar placeholders | New "Response Schemas" section: `UserOut`, `BoardOut` (with the user's `role`), `ColumnOut`, `CardOut` (with `board_id`, `board_name`, nested `assignee { id, name }`), `CommentOut` (nested `author { id, name }`), `NotificationOut`, `MemberOut`; every endpoint row now names its schema |
| `PATCH /api/cards/<id>/position` | `200 { "data": { card fields including completed_at... } }` | `200 { "data": { "card": CardOut, "rebalanced": bool, "column_orders": [ { id, order } ] } }`; `useDragAndDrop` applies `column_orders` so the next drag uses fresh values |
| `PATCH …/columns/reorder` | `200 { "data": { "id", "order" } }` | Same `rebalanced` / `column_orders` pattern |
| `order` validation | `validate.Range(min=1e-10)`, which rejects valid values in (0, 1e-10] | `validate.Range(min=0, min_inclusive=False)`, which is exactly "> 0" |
| `CardQuerySchema.assignee` | `fields.String()` (any value) | `fields.String(validate=OneOf(["me"]))`; no `assignee` and no `board_id` → `400` |
| Notifications `400` text | "`page` < 1 …" (out of date after R4) | "`page` is not an integer >= 1, or `per_page` is not an integer from 1 to 100" |

**Review of the result.**

- **Run out of order.** DR2 was sent before DR1 by mistake (DR2 was the section open in the editor). The rounds touch independent sections, so the order does not matter. This entry records it rather than hiding it; DR1 follows next.
- **Complete.** All 5 items were applied. The diff (102 additions, 22 deletions) only replaces success rows, adds the schema section, and rewrites the three schema lines named in the prompt.
- **Password safety.** `UserOut` has no `password_hash`, and it is the only schema used for user data, so Property 6 is now enforced by construction rather than by remembering to delete a key.
- **Partial gap.** The "neither `assignee` nor `board_id` → `400`" rule appears only as a comment in `CardQuerySchema`. The `GET /api/cards` endpoint row still lists only `401`/`404`. Added to DR4 as item 7.

---

## CL-09

**Design DR1: fix the 8 blockers**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/design.md` |
| Tool | Kiro, Spec mode |
| Trigger | Design review findings D1–D8 |
| Prompt | DR1 in [design-v1-review.md](reviews/design-v1-review.md#dr1--blockers) |
| Commits | before `1048724` → after `2c28f1a` |

**Trigger.** Design v1 described a system that would have failed at runtime. Each of these defects is invisible when you read the document, and only shows up when the code runs or the E2E suite hits it.

**Before → After.**

| # | Before | Consequence if built as written | After |
| - | ------ | ------------------------------- | ----- |
| D1 | `ValidationError` handled through `@app.errorhandler(422)` | Every validation error returns **500** (plain Marshmallow never raises HTTP 422) | `@app.errorhandler(ValidationError)` → `400 { "error": … }` |
| D2 | Only a catch-all `Exception` handler, plus 404/405 | Malformed JSON (400) and 415 become **500** | `@app.errorhandler(HTTPException)` → `e.code` + `{ "error": e.description }` |
| D3 | "JWT error handlers → 401", no detail | Library default `{ "msg": … }` breaks the envelope; a malformed token returns **422** | `unauthorized_loader`, `invalid_token_loader`, `expired_token_loader` → `401 { "error": … }` |
| D4 | `Notification.card_id` / `board_id` FKs with no `ondelete` | `DELETE /api/boards/<id>` → IntegrityError → **500** once a `board_invite` exists | `ondelete="SET NULL"` on both |
| D5 | `app/middleware.ts` | Next.js ignores it there, so **no route protection** and Playwright auth scenarios 3 and 4 fail | `frontend/middleware.ts` at the project root (`proxy.ts` on Next.js 16+) |
| D6 | Root layout renders `Header` on every page | On `/login`, the bell polls without a token, gets `401`, redirects, and **loops** | Root layout holds only providers and `Toaster`; `Header` lives in `app/(app)/layout.tsx` (`/`, `/boards/[id]`, `/my-tasks`, `/profile`) |
| D7 | Flask and Next.js both rooted at `app/` | The two projects cannot coexist in one repo | `backend/app/…` and `frontend/app/…`; every traceability path updated |
| D8 | `joinedload` through the plain `Column.cards` relationship | **Soft-deleted cards appear** on the board (violates REQ-5.3) | `selectinload(Board.columns).selectinload(Column.cards.and_(Card.deleted_at.is_(None)))` |

**Review of the result.**

- **Complete.** Each fix was confirmed by searching the updated document: the ValidationError and HTTPException handlers, the three JWT loaders, `ondelete="SET NULL"` on both FKs, `frontend/middleware.ts` at the root, the `(app)` route group, 26 `frontend/` and 5 `backend/` paths, and the filtered `selectinload`.
- **Scope respected.** Most of the diff (115 additions, 106 deletions) is path rewrites for D7. Every deletion outside the targeted sections was checked: they are only folder-tree lines moved under the new roots.
- **One mistake introduced.** The REQ-19 traceability row now points to `backend/boards/service.py`, which skips `app/blueprints/`. Moved to DR4 (item 8).
- **Why these were not caught by Kiro.** Kiro's own end-of-round summaries never flagged any of D1–D8. Each needs knowledge of library behavior (Marshmallow, Flask-JWT-Extended, Next.js file conventions, PostgreSQL FK semantics) that a document-level consistency check does not catch.

---

## CL-10

**Design DR3: harden the data layer**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/design.md` |
| Tool | Kiro, Spec mode |
| Trigger | Design review findings D14–D17 |
| Prompt | DR3 in [design-v1-review.md](reviews/design-v1-review.md#dr3--data-layer) |
| Commits | before `2c28f1a` → after `aeee52e` |

**Trigger.** The models would have worked on day one but caused slow queries, timezone bugs and a failed first deploy.

**Before → After.**

| # | Before | Problem | After |
| - | ------ | ------- | ----- |
| D14 | `db.Column(db.DateTime, default=datetime.utcnow)` (×16) | `utcnow` is deprecated since Python 3.12 and produces naive datetimes, so the browser reads them as local time | `db.DateTime(timezone=True)`, `default=lambda: datetime.now(timezone.utc)`; 0 `utcnow` left |
| D15 | No indexes on foreign keys | PostgreSQL does not index FKs automatically, so `GET /api/cards?assignee=me`, the board load and the notification list do full scans (NFR-2) | `index=True` on `board_members.user_id`, `columns.board_id`, `cards.column_id`, `cards.assignee_id`, `comments.card_id`, `notifications.user_id` |
| D16 | `class Column(db.Model)` | Collides with SQLAlchemy's `Column` name and invites import shadowing | `class BoardColumn(db.Model)` with `__tablename__ = "columns"`; relationship strings updated |
| D17 | `config.py` reads `DATABASE_URL` as is; no frontend env template | Railway issues `postgres://…`, which SQLAlchemy 1.4+ rejects, so the **first deploy crashes**. The frontend `.env.example` is a graded deliverable | `postgres://` is normalized to `postgresql://`; backend env vars listed; `frontend/.env.example` with `NEXT_PUBLIC_API_BASE_URL` and `API_BASE_URL` |

**Review of the result.**

- **Verified by search.** No `utcnow` remains, there are 16 `timezone=True` columns, all 6 indexes are present, and the normalization comment and `.env.example` entry are in place.
- **Incomplete rename.** `BoardColumn` was applied to the model and its relationship strings, but two prose references still say `Column.cards`: the `boards/service.py` comment and the REQ-19 traceability row. A blind rename usually misses code-like text inside comments and tables. Moved to DR4 as item 9.
- **Not a mistake.** The frontend TypeScript type is still called `Column` (`types/index.ts`). It is a separate namespace from the Python model, so it was intentionally left alone.

---

## CL-11

**Design DR4: per-criterion traceability and consistency fixes**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/design.md` |
| Tool | Kiro, Spec mode |
| Trigger | Design review findings D18–D23, plus leftovers from DR1 to DR3 |
| Prompt | DR4 in [design-v1-review.md](reviews/design-v1-review.md#dr4--traceability-and-consistency) |
| Commits | before `aeee52e` → after `2e79f87` |

**Trigger.** The rubric requires that *every acceptance criterion* maps to a Flask route or Next.js page. The v1 table mapped whole requirements, so mixed requirements such as REQ-10 (API and UI) had no criterion-level mapping. Several smaller inconsistencies had also accumulated across rounds.

**Before → After.**

| Item | Before | After |
| ---- | ------ | ----- |
| Traceability table | 32 rows, one per REQ, e.g. `REQ-10 \| Comments \| POST/GET … + CommentList.tsx` | Rows per criterion range, with a new **Criteria** column, e.g. `REQ-5 \| 6 \| Board 404 for non-members \| boards service.py membership check` |
| Form components (REQ-32.5) | No create-board, add-column or add-card component | `CreateBoardModal.tsx` (calls `router.refresh()`), `AddColumnForm.tsx`, `AddCardForm.tsx`, all inside `BaseModal` |
| Property tests | Hypothesis, a dependency not in the tech stack | Removed; Properties 1–3 tested with ordinary pytest cases |
| Rollback test | Attributed to `useErrorHandler` | Attributed to `useDragAndDrop` (mocked API error → position restored + toast); `useErrorHandler` tests status → toast mapping |
| Property 6 | "Validates: Requirements 2.4, 14.1, 18.1" | 18.1 replaced (it is now "Covered by REQ-2.4") |
| Business errors | "routes.py catches them" (try/except in each route) | Service raises `AppError(status_code, message)`; one app-factory handler renders the envelope |
| `GET /api/cards` errors | `401`, `404` only | Adds `400` when neither `assignee` nor `board_id` is given |
| REQ-19 path | `backend/boards/service.py` | `backend/app/blueprints/boards/service.py` |
| Rename leftovers | 2 × `Column.cards` | `BoardColumn.cards` |

**Review of the result.**

- **All 9 items applied**, each confirmed by searching the updated document.
- **Coverage was verified, not trusted.** A script compared the 187 criteria in `requirements.md` with every range in the new table ([method](reviews/design-v1-review.md#traceability-coverage-check-script)). Result: **186 of 187** covered exactly once, 0 duplicates, 0 references to nonexistent criteria, and **REQ-2.6 missing** (the password-length `400` added in R6). Kiro's summary did not mention the gap.
- **Fix.** A one-line refinement round, DR5, adds `6` to the REQ-2 API row.

---

## CL-12

**Design DR5: close the last traceability gap, and accept the design**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/design.md` |
| Tool | Kiro, Spec mode |
| Trigger | The coverage script after DR4 ([CL-11](#cl-11)) |
| Prompt | DR5 in [design-v1-review.md](reviews/design-v1-review.md#dr5--close-the-last-traceability-gap) |
| Commits | before `2e79f87` → after `9fde0bf` |

**Before.**

> `| REQ-2 | 1–4 | User Registration — API | POST /api/auth/register (auth blueprint) |`

REQ-2.6 (password shorter than 8 characters → `400`) mapped to nothing.

**After.**

> `| REQ-2 | 1–4, 6 | User Registration — API | POST /api/auth/register (auth blueprint) + RegisterSchema validate.Length(min=8) |`

**Review of the result.**

- **Verified.** The diff is exactly one line. Re-running the coverage script: **187 of 187 criteria mapped exactly once**, 0 duplicates, 0 references to nonexistent criteria.

**Status: design accepted.** Summary of the design phase:

| | v1 (raw Kiro) | Accepted |
| - | ------------- | -------- |
| Defects that would break the running app or a graded E2E scenario | 7 (D1–D7) | 0 |
| Response bodies defined | 0 (placeholders) | 7 dump schemas |
| Traceability | 32 REQ-level rows | 187/187 criteria mapped, script-verified |
| Refinement rounds | n/a | 5 (DR1–DR5, [CL-08](#cl-08) to CL-12) |

Next phase: `tasks.md`.

---

## CL-13

**Tasks TR1: correctness and scope**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-26 |
| Artifact | `.kiro/specs/revotask-mvp/tasks.md` (raw output generated by Kiro) |
| Tool | **Claude Code** (see the note below) |
| Trigger | Tasks review findings T1–T7 ([tasks-v1-review.md](reviews/tasks-v1-review.md)) |
| Prompt | TR1 in [tasks-v1-review.md](reviews/tasks-v1-review.md#tr1--correctness-and-scope) |
| Commits | before `262f6c4` (raw tasks v1) → after `6b59111` |

**Tool change.** Kiro generated `tasks.md` v1, and then its free plan hit the monthly usage limit (0 of 50 credits left), so the TR1 prompt could not be sent to Kiro. The same prompt was applied with Claude Code instead. The review method did not change: targeted prompt, diff check, search-based verification.

**Trigger.** The raw plan contained two behaviors that no requirement asks for, one module layout that fails the Next.js build, a test database choice that hides production bugs, and a missing CORS step that would block the live app.

**Before → After.**

| # | Task | Before | After |
| - | ---- | ------ | ----- |
| T1 | 13.1 | Install `@dnd-kit/core` "(or native HTML5 DnD — align with design)" | No drag-and-drop library; native HTML5 Drag and Drop API only (REQ-9.9) |
| T2 | 7.1 `move_card` | "trigger N1 notification if card has assignee and not self" on every move | No notification on a move; N1 only when `assignee_id` is set or changed (REQ-11.1) |
| T3 | 2.1 `conftest.py` | "in-memory or test-database config" | Separate PostgreSQL database from `TEST_DATABASE_URL`; never in-memory SQLite. `TEST_DATABASE_URL` added to `backend/.env.example` |
| T4 | 13.3 `lib/auth.ts` | `document.cookie` **and** `next/headers` in one module | Client-only, never imports `next/headers`; Server Components read `cookies()` themselves; `apiClient` takes the token as an argument |
| T5 | 1.1 | `cors` extension listed but never configured | Flask-CORS configured from `CORS_ORIGINS`; REQ-18.5 referenced |
| T6 | 22.1 | Deploy, then verify the login page loads | Also: add the Vercel URL to `CORS_ORIGINS` on Railway, redeploy, verify a browser login from the live site |
| T7 | 14.4 | `frontend/middleware.ts` | Notes that Next.js 16+ uses `frontend/proxy.ts` |

**Review of the result.**

- **Verified by search.** `@dnd-kit` appears 0 times. The move-notification text and "in-memory or test-database" are gone. `next/headers` now appears only in the sentence that forbids importing it. `CORS_ORIGINS` is configured in task 1.1 and updated in task 22.1.
- **Why T1 and T2 matter.** Both were *additions* by the AI, not omissions. An invented dependency and an invented notification trigger would each have produced code that contradicts the accepted requirements while looking reasonable in review.
- **Still open.** Test tooling setup, deliverable tasks and the 15 unreferenced criteria are handled in TR2.

---

## CL-14

**Tasks TR2: test setup, deliverables and traceability, and accept the tasks**

| Field | Value |
| ----- | ----- |
| Date | 2026-11-27 |
| Artifact | `.kiro/specs/revotask-mvp/tasks.md` |
| Tool | Claude Code (Kiro's free plan was out of credits; see [CL-13](#cl-13)) |
| Trigger | Tasks review findings T8–T14 |
| Prompt | TR2 in [tasks-v1-review.md](reviews/tasks-v1-review.md#tr2--test-setup-deliverables-and-traceability) |
| Commits | before `6b59111` → after `98d46b7` |

**Trigger.** The plan ran Jest and Playwright without ever installing or configuring them, had no task for any non-code deliverable, did not put the guidelines before the code, never measured the performance target, and left 15 acceptance criteria unreferenced.

**Before → After.**

| # | Before | After |
| - | ------ | ----- |
| T8 | Task 21 runs Jest, but nothing installs it; no component tests | Task 13.1 installs and configures Jest + React Testing Library and adds `"test": "jest"`; new task 13.6 tests `BaseButton`, `BaseBadge` and `BaseModal` |
| T9 | Playwright specs with no setup and no test account | New task 23.0: install `@playwright/test`, `playwright.config.ts` with `baseURL` from `E2E_BASE_URL`, HTML reporter, a unique test user registered per run |
| T10 | Specs in `e2e/` at the repo root | Specs in `frontend/e2e/` |
| T11 | No deliverable tasks | New group 25: copy specs to `/specs`, Postman check of all 8 blueprints, Playwright report committed, README, violation report |
| T12 | Guidelines not ordered before code | New task 0.1 at the top: author `/guidelines` before any code task |
| T13 | REQ-19.1 (500 ms p95) never measured | New task 22.2: seed 200 cards on Railway, measure p95 |
| T14 | 172 of 187 criteria referenced | 187 of 187 referenced |

**Review of the result.**

- **Verified by script.** 187 of 187 criteria are referenced by at least one task, with 0 references to nonexistent criteria. All 30 endpoints are present. All 55 sub-tasks appear in the dependency graph, and the graph has no task that is missing from the plan.
- **Dependency graph repaired.** The new tasks were added to the wave list and the waves renumbered 0–41.

**Status: tasks accepted.** Summary of the specification phase:

| Document | Raw AI output | Accepted | Rounds |
| -------- | ------------- | -------- | ------ |
| `requirements.md` | 24 REQs, 119 criteria, 5 wrong paths | 32 REQs, 187 criteria | R1–R6 (Kiro) |
| `design.md` | 7 runtime blockers, REQ-level traceability | 0 blockers, 187/187 criteria traced | DR1–DR5 (Kiro) |
| `tasks.md` | 2 invented behaviors, 172/187 criteria referenced | 187/187 referenced, 30/30 endpoints | TR1–TR2 (Claude Code) |

The accepted documents were copied to `/specs`. Next phase: steering guidelines, then code.
