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
| Commits | before `b968ca0` → after: the R3 refinement commit |

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
