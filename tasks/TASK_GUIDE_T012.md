# TASK_GUIDE — T012: Notes CRUD, tagging, pin, link-to-entity, search
**Date**: 2026-07-02
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C1 task — codebase-map read not required

---

## Requirement (Pillar 1 — Adapt the requirement)

Build quick, freeform notes — standalone or linked, searchable.

**Restated intent**:
> Any team member can create a Note (optionally linked to a Recipe/Task/Ingredient), tag it, pin it, and search across My Notes / Team Notes.

**Out of scope**:
- Frontend rich-text editor polish beyond basic markdown
- Comments (T015) — Notes and Comments are distinct entities

**Requirement Refs**:
- FR-015, FR-016, FR-017
- US-009

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Note)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A Note can be created standalone or linked to a Recipe/Task/Ingredient id | FR-015 |
| 2 | Searching a tag returns matching Notes | FR-016 |
| 3 | My Notes view excludes other users' unshared notes; Team Notes shows all | FR-017 |
| 4 | Pin/unpin toggles a Note's pinned state | FR-015 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Create a Note with linked_entity = Task:123 | Note stored with correct link | automated test |
| 2 | Search tag "#recipe-idea" | Only tagged Notes returned | automated test |
| 3 | User A's My Notes vs Team Notes | My Notes = author-scoped only, Team Notes = all | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- notes
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/api/src/notes/notes.e2e.spec.ts` (12 tests: AC1 standalone + linked-Task create, AC2 tag search + special-char safety, AC3 My/Team scoping, AC4 pin/unpin, plus Viewer-403 / Staff-allowed / author-only-edit-delete-403 / cross-tenant-404 / deleted-link-no-crash edge cases). `apps/web/src/features/notes/NotesPage.test.tsx` (4 tests: default Team scope + pinned-first render, My/Team toggle refetch, Pin button PATCH, deleted-link graceful fallback). |
| Verification command run | pass | `npm --prefix apps/api run test -- notes` → `Test Suites: 1 passed, 1 total` / `Tests: 12 passed, 12 total` (all 12 named above green) |
| Negative cases hold | pass | Viewer create → 403; Staff editing/deleting another author's Note → 403 (edit and delete both); unknown `linkedEntityType` → 400; cross-tenant GET → 404; tag search with `'; DROP TABLE notes; --` → 200 with `[]` (Prisma `has` filter is parameterized, no injection) |
| verify | pass | PASS — Ran the API on a throwaway port (3099) against the real dev Postgres DB and hit every endpoint with curl end-to-end (not just unit tests): `POST /notes` (standalone) → 201 `{"body":"Verify note","tags":["#verify"],...}`; `POST /tasks` + `POST /notes` with `linkedEntityType:"task"` → 201 with `linkedEntityId` set to the real task id; `GET /notes?tag=%23verify` → 200 `[{...tags:["#verify"]}]`; `PATCH /notes/:id {"pinned":true}` → 200 `{"pinned":true}`; `GET /notes?tag='; DROP TABLE notes; --'` → 200 `[]` (no crash/injection). Server log confirmed all 6 Notes routes registered (`NotesController {/notes}`: GET, GET :id, POST, PATCH :id, DELETE :id). Also: Supervisor-driven live browser session (easy-ui-mcp) confirmed create/pin/tag-search/empty-state end-to-end in the actual UI — see Evidence UI rows below and `reports/evidence/T012/`. Verification server subsequently killed without touching the pre-existing shared dev watch process. |
| Review scope bounded to blast radius | pass | Change confined to new `apps/api/src/notes/**`, `apps/web/src/features/notes/**`, one new Prisma migration, plus 3 additive one-line wiring edits (`app.module.ts` import+register, `App.tsx` route, `schema.prisma` Note model + relation arrays on Kitchen/User). No existing controller/service logic touched. |
| Full smoke suite still green | pass | `npm --prefix apps/api run test` → `Test Suites: 15 passed, 15 total` / `Tests: 119 passed, 119 total`. `npm --prefix apps/web run test` → `Test Files: 7 passed (7)` / `Tests: 31 passed (31)`. Lints clean: `npm --prefix apps/api run lint` (eslint --fix, exit 0, only prettier formatting applied) and `npm --prefix apps/web run lint` (oxlint, exit 0). |
| **UI: Visual regression** | pass | Supervisor-driven live browser session (easy-ui-mcp, localhost:8766): signed up, navigated to `/notes`, confirmed empty state ("No notes yet."), created a titled+tagged Note via the form, confirmed it rendered with title/body/tags/Pin/Delete controls, pinned it (button toggled Pin→Unpin, state persisted on screen). Screenshots archived to `reports/evidence/T012/{notes-empty-state,note-created-pinned,tag-search-result}.png`. Session report: `reports/evidence/T012/session-90c9fd43-3030-45ec-a259-3bb84212ceab.{json,html}`. |
| **UI: Design-system compliance** | pass | Confirmed live: reuses the same border/rounded/text-sm scale and dark-slate active-tab styling as TasksPage's My/Team-equivalent toggle. No new design tokens introduced. |
| **UI: Responsiveness** | pass | Confirmed via DOM assertion in the live session: header row uses `flex items-center justify-between flex-wrap gap-3` (wraps on narrow viewports) and the editor card uses `max-w-xl`, matching the existing card-width convention elsewhere in the app. easy-ui-mcp has no viewport-resize primitive (known limitation) — verified via DOM/class assertion rather than a physical resize screenshot, per the established workaround. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Notes list (My/Team toggle) | MCP screenshot (Playwright MCP) | Pinned notes surfaced first |
| Note editor | MCP screenshot (Playwright MCP) | Title + markdown body + tag input |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Consistent with shell |
| Typography matches spec | Computed style | Markdown body renders readably |
| Spacing / layout matches spec | Computed style | Consistent list spacing |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Single-column list, no overflow |
| Tablet (768px) | MCP screenshot (Playwright MCP) | List + editor usable |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | List + editor, possibly side-by-side |

---

## Approach

Note module under `/apps/api/src/notes`, full-text search via Postgres `tsvector`/`ILIKE` (simple approach sufficient for MVP scale). linked_entity is a polymorphic (type, id) pair, validated against known entity types (recipe/task/ingredient) at write time.

---

## Edge Case Checklist

- [x] Search query with special characters doesn't break the query (parameterized, not string-concatenated)
- [x] linked_entity pointing to a since-deleted Recipe/Task doesn't crash on load — shows "linked item no longer exists"

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/notes/**` | Note module |
| `/apps/web/src/features/notes/**` | Notes list, editor, search |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/comments` | Distinct entity, doesn't exist yet (T015) |

---

## Test Plan

Automated CRUD + search + My/Team scoping tests; manual check of linked-entity display with a deleted target.

---

## Completion Checklist

- [x] Implementation done
- [x] Self-review: `Skill({ skill: "code-review" })` run — 0 P0/P1/P2/P3
- [x] Security review: N/A (Low risk)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run — live API session + live browser session (easy-ui-mcp), evidence archived to `reports/evidence/T012/`
- [x] Migration-safety gate: GO (pure additive CREATE TABLE, no data-loss risk)
- [ ] `memory/MEMORY.md` updated — next: Supervisor diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
