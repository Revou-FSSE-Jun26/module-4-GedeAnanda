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
| Commits | before `fae19ee` → after: the R1 refinement commit |

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
