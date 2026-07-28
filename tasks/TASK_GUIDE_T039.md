# TASK_GUIDE — T039: Edit Task UI (title / assignee / due date / checklist)
**Date**: 2026-07-21
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P1
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. Note the **Complexity Level** above and apply the matching process (brainstorm / decompose / verify depth / model) from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. **C2/C3 or multi-file tasks only**: read `memory/codebase-map.md` for directory layout, entry points, and blast-radius hotspots

---

## Requirement (Pillar 1 — Adapt the requirement)

Original user request (verbatim):

> "implement the feature that allow users update the tasks"
> "I check from UI but it does not have feature to update the tasks"

**Restated intent** (Supervisor's interpretation, in the project's domain language):
> A user with sufficient role can open an existing Task from the Tasks page and change its
> **title**, **assignee**, **due date**, and **checklist items** — not just its status. The backend
> `PATCH /tasks/:id` already supports every one of these fields; only the frontend affordance is
> missing.

**Out of scope** (what this task explicitly does NOT do):
- **No backend changes.** `PATCH /tasks/:id` and `UpdateTaskDto` already cover all five fields.
- **No task deletion.** There is no `DELETE /tasks/:id` route on the backend; adding one is a
  separate task with its own migration/RBAC/audit questions. Do not add a Delete button.
- No bulk edit, no drag-between-kanban-columns reordering.
- No change to the existing status-transition flow (`updateTaskStatus`) or the completion flow
  (`previewTaskCompletion` / `confirmTaskCompletion` / `CompleteTaskDialog`) — those already work.
- No change to `recurrence` / template-occurrence behaviour (T010).

**Requirement Refs** (FR/NFR/US IDs from `PRD.md` this task satisfies):
- FR-018: role-based permissions on Task mutation (Staff manages own Tasks, Viewer read-only)
- The Task-management user story covered by T008's backend CRUD, whose update half was never
  surfaced in the UI

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor — user reported the gap from the UI directly)
- [x] Domain terms align with `PROJECT_SPEC.md` glossary (Task, assignee, checklist item, kitchen scoping)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] All Requirement Refs exist in `PRD.md` and are fully covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: `None` — every backend dependency already exists and is merged.
> `PATCH /tasks/:id` shipped in T008 (`apps/api/src/tasks/tasks.controller.ts:66`), its RBAC was
> corrected in T019, and the `Dialog` primitive it will reuse shipped in T029/T037.

**Entry point**: `EditTaskDialog`
> Reached from an "Edit" control on `TaskCard` in both `KanbanBoard.tsx` and `ListView.tsx`.

---

## Acceptance Criteria

> Each criterion must trace back to the Requirement above (Pillar 1 → Pillar 3 link).

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | An Owner/Admin/Chef can open `EditTaskDialog` from a task and change **title**, **assigneeId**, **dueAt**, and **checklistItems**; on save the task reflects all changes | "allow users update the tasks" |
| 2 | The Edit control is reachable from **both** the Kanban view and the List view (not just the default view) | Restated intent; T035 drift learning |
| 3 | A **Staff** user sees no Edit control for a task **not** assigned to them, and no title/assignee/due-date fields for one that is (Staff may only change status + checklist) | FR-018 — Staff manages own Tasks |
| 4 | A **Viewer** never sees an Edit control on any task | FR-018 — Viewer is read-only |
| 5 | Submitting an empty title is rejected client-side and no PATCH is issued (backend `@MinLength(1)`) | Negative / boundary |
| 6 | A failed PATCH (e.g. 403) surfaces through the global error dialog and leaves the task list unchanged | T029 error-dialog contract |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Chef opens Edit on a task, changes title to "Prep mise en place", saves | `PATCH /tasks/:id` sent with `{title}`; card shows new title in both views | automated test + live verify |
| 2 | Chef reassigns a task to another kitchen member | `assigneeId` updated; card shows the new assignee | automated test |
| 3 | Staff user, task assigned to them | Edit dialog shows status + checklist only — no title/assignee/dueAt inputs | automated test |
| 4 | Staff user, task assigned to someone else | No Edit control rendered | automated test |
| 5 | Viewer user, any task | No Edit control rendered | automated test |
| 6 | Title cleared to `""`, save pressed | Save blocked, validation message shown, zero network calls | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npx vitest run src/features/tasks && npm run build
```

> `npm run build` is included deliberately: T038's learning is that `tsc -b` catches breakage
> `vitest` does not. Run the command yourself — do not trust a reported pass (T016 learning).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | 18 new tests, all written as part of T039. `apps/web/src/features/tasks/EditTaskDialog.test.tsx` (new, 6 tests: date-helper round-trip, due-date-clear refusal, blank checklist item, no-op close, remove-item payload). `apps/web/src/features/tasks/TasksPage.test.tsx` (+12 tests, AC1–AC7 incl. both-views assertions). Output: `Test Files 4 passed (4) / Tests 37 passed (37)` — a pass. |
| Verification command run | ☒ pass | Ran the guide's exact command myself (T016 learning — did not trust a reported pass). `cd apps/web && npx vitest run src/features/tasks` → `Test Files 4 passed (4), Tests 37 passed (37), Duration 2.39s`. `npm run build` → `vite v8.1.3 building client environment for production... ✓ 76 modules transformed. ✓ built in 207ms` — clean, no `tsc -b` errors (T038 learning). Both pass. |
| Negative cases hold | ☒ pass | Verified live against the running API, not only in mocks (`reports/evidence/T039/17-supervisor-verify-api.sh`, 12/12 passed): AC3 STAFF checklist edit on own task → 200, STAFF title edit → **403**; AC4/AC5 VIEWER PATCH → **403**; AC6 empty title → **400** server-side and blocked client-side (live browser assert on "Title is required" passed, zero network call). Extra edges: explicit unassign `assigneeId:null` → null persisted; cross-kitchen assignee → rejected. All pass. |
| verify | ☒ pass | Stage 5 verify run by the Supervisor against the live stack (postgres + API :3000 + web :8766 from this worktree). API contract: 12/12 checks pass (`OVERALL: pass`). Live browser (easy-ui-mcp session `9845e335`): opened Edit from Kanban, blank title blocked, retitled to "Prep mise en place" + dueAt 2026-08-01 + checklist rename, saved; card updated; switched to List view — Edit control and updated title both present (T035 drift check pass); reopened dialog from List, fully pre-populated incl. due-date round-trip. Server-side GET confirmed persistence: title, `dueAt: "2026-08-01T00:00:00.000Z"`, item 1 renamed with **id and done preserved**, item 2 untouched. Evidence: `reports/evidence/T039/14-supervisor-verify-session.json`. NOTE: session status reads "failed" — 3 not-ok actions, all Supervisor harness/selector errors (ambiguous selector, prose passed to ui_assert, wrong List selector); all 3 product assertions returned ok=true. Result is a pass. |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed: the 9 changed files under `apps/web/src/features/tasks/` plus their only consumer (`TasksPage.tsx`). Read as contract authority but not reviewed: `tasks.service.ts`, `update-task.dto.ts`, `checklist-item.dto.ts`, `users.controller.ts`, `main.ts`. Skipped: the rest of the repo — untouched by this diff. The security-review harness supplied a mis-scoped 4.1MB whole-history diff (~300 pre-existing files); analysis was deliberately re-scoped to `fe05ddb..1ffa1b1`. A pass. |
| Full smoke suite still green (no regression) | ☒ pass | `npx vitest run` (full frontend suite) → `Test Files 29 passed (29) / Tests 174 passed (174)`, up from 156 pre-T039 with no failures or skips. |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | Screenshots reviewed directly by the Supervisor, not accepted on filename. `02-edit-dialog-simple.png` — dialog matches CreateTaskDialog layout conventions; `09-edit-dialog-dark-neon.png` — legible in dark-neon, correct surface/accent tokens; `12-staff-edit-dialog-checklist-only.png` — Staff sees checklist only (no title/assignee/due-date) AND the Edit control appears only on their own task, not the unassigned one, so AC3+AC4 are both visible in one frame; `15/16-supervisor-verify-*.png` — fresh captures from this session. |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | Submit button is `bg-accent text-white` (verified in source at `EditTaskDialog.tsx:285` and visually: purple in simple, crimson in dark-neon) — **never** the undefined `bg-primary`/`text-on-primary` that caused T033's invisible label. Dialog panel reuses the shared `Dialog` primitive (T037), which supplies `bg-surface-raised` (T026 gap learning). Both themes rendered correctly. |
| **UI: Responsiveness at target viewports** | ☒ pass | 320px (`10-dialog-320px.png`): dialog fits, fields stack, no horizontal overflow. Also captured at 375px, 768px, and 1280px (`10-dialog-*.png`) — centered, no overflow at any width. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `EditTaskDialog` (both themes) | Playwright screenshot + LLM vision verdict | Matches `CreateTaskDialog` layout conventions; readable in `simple` and `dark-neon` |
| `TaskCard` with Edit control, Kanban + List | Playwright screenshot | Edit control visible and legible in both views |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | Computed-style check on the submit button | `bg-accent text-white` — **never** `bg-primary`/`text-on-primary` (undefined; T033's invisible-label bug) |
| Surfaces use theme tokens | CSS audit | `bg-surface-raised` present on the dialog panel (T026 gap learning) |
| Modal pattern | Code review | Reuses the shared `Dialog` primitive, per T037 — not an inline or full-page form |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | Playwright | Dialog fits, no horizontal overflow, fields stack |
| Tablet (768px) | Playwright | Dialog centered, no overflow |
| Desktop (1024px+) | Playwright | Dialog centered at max-width |

---

## Approach

Mirror `CreateTaskDialog.tsx` as closely as possible — it already solves dialog layout, form state,
and submission against this exact domain. Concretely:

1. Add `updateTask(id, input)` to `apps/web/src/features/tasks/api.ts`, alongside the existing
   `updateTaskStatus` / `updateTaskChecklist`. It PATCHes the same endpoint with the broader field
   set. Use the file's existing `request<T>()` helper so T029's `notifyApiError()` wiring applies
   for free — do **not** introduce a new HTTP client.
2. Add `EditTaskDialog.tsx` built on the shared `Dialog` primitive, pre-populated from the task.
3. Add an Edit control to **both** `TaskCard.tsx` (Kanban) **and** `ListView.tsx` (List).

   > ⚠️ **Verified 2026-07-21 — do not assume otherwise:** `ListView.tsx` does **not** render
   > `TaskCard`. It renders its own `<li>` markup. So this is genuinely **two** edits, not one
   > shared change. This asymmetry is exactly what caused T035's P2 (source-title line added to
   > the card but missed in the list). Add the control in both places and test both.
4. Gate visibility on the caller's role from `getUser()`, mirroring the service's rules exactly.

**Why role-gate the client at all, given the server enforces it?** Purely for affordance — a
control that always 403s is a UX bug. The server remains the only real authority; never treat the
client gate as the security boundary.

---

## RBAC Contract (verified against `apps/api/src/tasks/tasks.service.ts`, do not guess)

`@Patch(':id')` carries **no `@Roles` decorator** — enforcement lives in `TasksService.update`:

| Role | May change |
|---|---|
| `OWNER` / `ADMIN` / `CHEF` (`WRITE_ROLES`) | Any field, on any task in their kitchen |
| `STAFF` | `status` and `checklistItems` **only**, and **only** on a task where `assigneeId === caller.id` |
| `VIEWER` | Nothing — always `403 Forbidden` ("Viewer role is read-only", the T019 fix) |

`assigneeId` must resolve to a user in the caller's own kitchen, else the service throws
(`assertAssigneeInKitchen`). Never send a raw user ID from an unscoped list.

> Read this table, not another task's RBAC shape. Memory's T013 learning is explicit: this codebase
> has at least four distinct RBAC shapes, and copying one to another feature has caused real bugs.

---

## Edge Case Checklist

- [ ] Staff editing their **own** task: only status + checklist rendered — assignee/title/dueAt must not merely be disabled-but-submittable
- [ ] `assigneeId` picker lists only members of the caller's own kitchen
- [ ] Unassigning a task (clearing assignee) — decide and test the behaviour rather than sending `undefined` by accident
- [ ] `dueAt` round-trips correctly (backend expects an ISO `@IsDateString`; an `<input type="date">` value is not one)
- [ ] Editing `checklistItems` here must not corrupt the completion flow's checklist state (T008 learning: a field-name allowlist does **not** scope field *content* — sending the array replaces it wholesale)
- [ ] Empty/whitespace-only title blocked client-side
- [ ] Concurrent edit: task changed server-side since the dialog opened — at minimum do not silently clobber unrelated fields; send only changed fields
- [ ] Both Kanban and List views show the updated task without a manual refresh
- [ ] Dialog is dismissable and does not flicker on first open (T035 fixed exactly this bug on `CreateTaskDialog`)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/tasks/api.ts` | Add `updateTask(id, input)` using the existing `request<T>()` helper |
| `apps/web/src/features/tasks/types.ts` | Add `UpdateTaskInput` type mirroring `UpdateTaskDto` |
| `apps/web/src/features/tasks/EditTaskDialog.tsx` | **New** — the edit form, built on the shared `Dialog` |
| `apps/web/src/features/tasks/TaskCard.tsx` | Add role-gated Edit control (Kanban view) |
| `apps/web/src/features/tasks/ListView.tsx` | Add the same role-gated Edit control — this file does NOT reuse `TaskCard` |
| `apps/web/src/features/tasks/TasksPage.tsx` | Wire dialog open/close state + refresh on save |
| `apps/web/src/features/tasks/TasksPage.test.tsx` | Tests for AC1–AC6 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | Backend already supports every field; this task is frontend-only |
| `apps/api/prisma/schema.prisma` | No schema change — no migration in scope |
| `apps/web/src/features/tasks/CompleteTaskDialog/**` | Completion flow works; out of scope |
| `apps/web/src/components/Dialog/Dialog.tsx` | Reuse the shared primitive as-is; generalizing it again is a separate task |

---

## Test Plan

Component tests in `TasksPage.test.tsx` (or a sibling `EditTaskDialog.test.tsx`) covering all six
Success Criteria, with the API module mocked to assert the exact PATCH payload.

Per the T035 learning, **AC2's both-views check must actually render both views** — a test that only
exercises the default Kanban view will not catch List-view drift, which is precisely how T035 shipped
a P2.

Then a live browser pass (Playwright — `easy-ui-mcp` has been unavailable in this environment since
2026-07-14) against `localhost:8766` for the UI Evidence rows, with screenshots archived to
`reports/evidence/T039/` and committed. A UI change is not evidenced until those files are in the
repo.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run (Medium risk — RBAC-affecting)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `npm run build` clean (T038 learning — `vitest` alone is not sufficient)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app
- [ ] `memory/MEMORY.md` updated (if new patterns or feedback learned)
- [ ] Supervisor notified: task ready for Stage 4 review
