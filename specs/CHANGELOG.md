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
