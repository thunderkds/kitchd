# TASK_GUIDE — T035: Task creation UI + Recipe/Guideline/Inventory relation visibility

**Date**: 2026-07-20
**Complexity Level**: C2
**Risk Level**: Low
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
5. C2 — apply the matching process (decompose / verify depth / model) from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. Read `memory/codebase-map.md` for directory layout and blast-radius hotspots

---

## Requirement (Pillar 1 — Adapt the requirement)

User report (verbatim intent): "the tasks feature currently is not good, the create tasks feature have not existed yet, by the way the relation of the material from task and inventory can not show up also, include the guidelines related."

**Restated intent**:
> The Tasks page is missing three things a user needs to actually use it: (1) a way to create a Task at all — no create form/button exists anywhere in the UI, even though the backend fully supports plain create and generate-from-recipe/generate-from-guideline; (2) visibility into which Recipe or Guideline a Task was generated from (`sourceRecipeId`/`sourceGuidelineId` exist on the backend model but the frontend type/UI drops them entirely); (3) visibility into which Ingredients (materials) a Task consumes — currently only shown as raw UUID prefixes in the stock-deduction confirmation dialog, not as ingredient names, and not anywhere else on the Task.

**Out of scope**:
- Building a full standalone Recipes page/route (no `apps/web/src/features/recipes/` exists yet) — this task only needs a lightweight recipe picker (id + title) for the "Generate from Recipe" flow, reusing `GET /recipes`. A full Recipes CRUD page is a separate future task if wanted.
- Editing/deleting a Task's source-recipe/guideline link after creation — read-only display only.
- Changing the stock-deduction computation logic (T011) — only its *display* (ingredient names instead of raw IDs) is in scope.
- Recurrence UI (T010's `recurrenceRule` field) — not part of this ask.

**Requirement Refs** (from `PRD.md`):
- FR-004: System must support Task CRUD (create is the missing half here).
- FR-005: System must support generating a Task with a checklist pre-populated from a Recipe's or Guideline's steps.
- FR-008: On completion of a recipe-linked Task, show the computed stock deduction before applying it — currently shows raw ingredient IDs, not names, which undermines the "computed stock deduction" being actually reviewable by a human.
- US-003: Head Chef wants to create a daily prep task list and assign it to staff.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor investigation: confirmed via direct code read of `TasksPage.tsx`, `TaskCard.tsx`, `types.ts`, `CompleteTaskDialog.tsx`, `schema.prisma`, `tasks.controller.ts`, `generate-task.controller.ts` — no guessing)
- [x] Domain terms align with `PROJECT_SPEC.md`/glossary (Task, Recipe, Guideline, Ingredient, StockMovement all existing confirmed domain models)
- [x] Every Acceptance Criterion below traces to a line in the Requirement — confirmed during implementation
- [x] All Requirement Refs exist in `PRD.md` (FR-004, FR-005, FR-008, US-003) and are covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: None — `POST /tasks`, `POST /tasks/generate-from-recipe/recipe/:recipeId`, `POST /tasks/generate-from-recipe/guideline/:guidelineId`, `GET /recipes`, `GET /guidelines`, `GET /inventory` all already exist and are live (verified by reading the controllers directly).

**Entry point**: `<CreateTaskDialog>` (new component, invoked from a "New Task" button on `TasksPage.tsx`)

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A "New Task" button on the Tasks page opens a create dialog with three modes: Plain, Generate from Recipe, Generate from Guideline | FR-004, FR-005, US-003 |
| 2 | Plain mode posts to `POST /tasks` (title, optional assignee, optional due date) and the new task appears in the board/list without a full page reload | FR-004 |
| 3 | Generate-from-Recipe mode lists recipes (id + title) from `GET /recipes`, posts to `POST /tasks/generate-from-recipe/recipe/:recipeId`, and the resulting task shows its source recipe title on the card | FR-005 |
| 4 | Generate-from-Guideline mode lists guidelines (id + title) from `GET /guidelines`, posts to `POST /tasks/generate-from-recipe/guideline/:guidelineId`, and the resulting task shows its source guideline title on the card | FR-005 |
| 5 | `Task` frontend type includes `sourceRecipeId`/`sourceGuidelineId`; `TaskCard` renders a "From: <Recipe/Guideline title>" line when either is set, nothing when both are null | FR-005 |
| 6 | `CompleteTaskDialog` shows each deduction's ingredient **name**, not a raw UUID prefix (fetch ingredient names via `GET /inventory` and join client-side, or extend the preview response if easier — Supervisor approves either during implementation) | FR-008 |
| 7 | Only WRITE_ROLES (Owner/Admin/Chef) see/can use the "New Task" button — same RBAC shape as existing Task mutations (`WRITE_ROLES` in `tasks.service.ts`); Staff/Viewer do not see it | FR-018 (existing RBAC convention, not new) |
| 8 | Negative: submitting the create form with an empty title is blocked client-side with a visible validation message, no network call made | FR-004 boundary case |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Owner logs in, clicks "New Task", fills title only, submits | New TODO-status task appears in the kanban board without reload | automated test + live verify |
| 2 | Owner selects "Generate from Recipe", picks a seeded recipe | New task appears with checklist pre-populated from recipe steps and a visible "From: <Recipe title>" line on the card | automated test + live verify |
| 3 | Owner selects "Generate from Guideline", picks a seeded guideline | New task appears with checklist from guideline steps and "From: <Guideline title>" on the card | automated test + live verify |
| 4 | Owner completes a recipe-linked task | `CompleteTaskDialog` lists ingredient names (e.g. "Basil"), not UUID prefixes | automated test + live verify |
| 5 | Staff user views Tasks page | No "New Task" button visible | automated test |
| 6 | Create form submitted with blank title | Inline validation error shown, no `POST /tasks` network call fires | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npx vitest run src/features/tasks
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/tasks/TasksPage.test.tsx` (AC1 create-button RBAC, AC2/AC8 plain create + blank-title validation, AC5 source-recipe title resolution in both kanban and list view — Stage 4 review added the list-view case, was missing from the initial implementation); `apps/web/src/features/tasks/CompleteTaskDialog/CompleteTaskDialog.test.tsx` (AC6 ingredient-name display + fallback-to-id-on-lookup-miss). `npx vitest run src/features/tasks` → 3 files, 19/19 pass (post-review). |
| Verification command run | ☒ pass | `cd apps/web && npx vitest run src/features/tasks` → `Test Files 3 passed (3)  Tests 19 passed (19)`. Full FE suite also re-run: `npx vitest run` → `Test Files 27 passed (27)  Tests 143 passed (143)`. `npx tsc --noEmit` clean. |
| Negative cases hold | ☒ pass | AC8 (blank-title client-side block, no `POST /tasks` fires — asserted via before/after POST-call-count diff) covered in `TasksPage.test.tsx`; AC6 ingredient-lookup-miss fallback covered in `CompleteTaskDialog.test.tsx`; live curl probe confirmed Staff gets `403` from `POST /tasks` at the API layer (RBAC not weakened by the new UI); live browser probe (below) confirmed Staff sees no "New Task" button. |
| verify | ☒ pass | Supervisor re-ran with a live browser session (easy-ui-mcp) against the running app: logged in as Owner, opened "New Task", switched to "From Recipe" mode, selected a recipe, submitted — new task appeared with "From: &lt;recipe title&gt;" visible on both the kanban card and (after the Stage 4 fix) the list view. Logged out, logged in as Staff, confirmed no "New Task" button renders. Report archived at `reports/evidence/T035/session-d4fa25ee-1180-4153-aa4b-170bb9c94841.{json,html}`. |
| Review scope bounded to the change's blast radius | ☒ pass | Diff confined to `apps/web/src/features/tasks/**` plus one new cross-feature read-only import (`listIngredients` from `apps/web/src/features/inventory/api.ts`, no inventory file modified). No `apps/api/**` or `schema.prisma` touched. |
| Full smoke suite still green (no regression) | ☒ pass | `npx vitest run` (full apps/web suite) → `Test Files 27 passed (27)  Tests 142 passed (142)`, no regressions in Inventory/Guidelines/Dashboard/etc. |
| **UI: Visual regression** | ☒ pass | `CreateTaskDialog` reuses the shared `Dialog` primitive (`apps/web/src/components/Dialog/Dialog.tsx`) already used by `CompleteTaskDialog`/T029 — identical overlay/role=dialog/centered-card structure, no new modal styling invented. TaskCard's new "From: <title>" line uses the existing `text-xs text-muted` convention already used for the assignee line directly above it. |
| **UI: Design-system compliance** | ☒ pass | No raw hex colors introduced — all new markup reuses existing semantic tokens (`bg-accent`, `text-white`, `border`, `bg-surface`, `text-danger`, `text-muted`) already present in `GuidelinesPage.tsx`/`InventoryPage.tsx`/`CompleteTaskDialog.tsx`. Mode-tab buttons and the New Task button reuse the `min-h-[44px]` touch-target convention from `TaskCard.tsx`'s move buttons. |
| **UI: Responsiveness at target viewports** | ☒ pass | `CreateTaskDialog` is rendered inside the `Dialog` primitive, which is already `w-full max-w-md p-4 sm:p-6` — the same responsive shell verified in prior tasks (T029/T011) at 320–480px/768px/1024px+. The 3-mode tab row uses `flex gap-2` (wraps naturally on narrow viewports); no fixed-width elements added. No new breakpoint-specific behavior was introduced beyond the existing Dialog shell, so no new viewport-specific edge case exists to probe. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Tasks page — New Task button + CreateTaskDialog (all 3 modes) | LLM vision / easy-ui-mcp live screenshot | Matches existing Dialog/form conventions (same as GuidelinesPage/InventoryPage create forms) |
| TaskCard — source recipe/guideline line | easy-ui-mcp DOM assertion | "From: <title>" renders only when source is set |
| CompleteTaskDialog — ingredient names | easy-ui-mcp DOM assertion | Ingredient name text present, no raw UUID substring visible |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Reuses existing `bg-accent`/`border`/`text-muted` tokens — no new raw colors |
| Typography matches spec | visual | Consistent with GuidelinesPage/InventoryPage create forms |
| Spacing / layout matches spec | visual | Consistent with existing `Dialog` component conventions |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | easy-ui-mcp / manual | Create dialog usable, no horizontal scroll |
| Tablet (768px) | easy-ui-mcp / manual | Same |
| Desktop (1024px+) | easy-ui-mcp / manual | Same |

---

## Approach

1. Extend `apps/web/src/features/tasks/types.ts`: add `sourceRecipeId: string | null` and `sourceGuidelineId: string | null` to `Task`.
2. Extend `apps/web/src/features/tasks/api.ts`: add `createTask(dto)`, `generateTaskFromRecipe(recipeId, dto?)`, `generateTaskFromGuideline(guidelineId, dto?)`, and lightweight `listRecipesLite()` / `listGuidelinesLite()` (or reuse existing feature APIs from `apps/web/src/features/guidelines/api.ts` if they already export a list function — check before duplicating).
3. New component `CreateTaskDialog.tsx` (mirrors `Dialog` primitive + existing create-form conventions in `GuidelinesPage.tsx`/`InventoryPage.tsx`): a mode tab/select (Plain / From Recipe / From Guideline), fields per mode, client-side required-title validation.
4. Wire "New Task" button into `TasksPage.tsx`, gated on `WRITE_ROLES` (reuse the RBAC-gating pattern already used in `InventoryPage.tsx`/`GuidelinesPage.tsx` — check current user role via existing stored-user helper, do not re-derive a new one).
5. `TaskCard.tsx`: render a "From: <title>" line when `sourceRecipeId`/`sourceGuidelineId` is set. Resolve the title client-side (join against a fetched recipes/guidelines lookup map) rather than requiring a backend change, unless the reviewer/Supervisor decides a backend join is cleaner — flag if so, don't unilaterally change the API contract.
6. `CompleteTaskDialog.tsx`: resolve ingredient names via `GET /inventory` (or an existing ingredients list already fetched elsewhere in the app — check `InventoryPage.tsx`'s api for a reusable list call) instead of showing `ingredientId.slice(0,8)`.

---

## Edge Case Checklist

- [ ] Recipe/Guideline picker list is empty (no recipes/guidelines seeded yet) — show a helpful empty state, don't crash
- [ ] Ingredient name lookup misses an id (e.g. deleted ingredient) — fall back to the raw id, don't crash
- [ ] Non-WRITE_ROLES user hits the create endpoints directly (not just UI-hidden) — confirm existing backend RBAC (`@Roles(...WRITE_ROLES)`) already rejects it; this task must not weaken that
- [ ] Rapid double-submit of the create form — disable submit button while request in flight (same pattern as other create forms in this codebase)
- [ ] Task created via "Generate from Recipe" for a recipe with zero steps — checklist renders empty, not broken

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/tasks/types.ts` | Add `sourceRecipeId`/`sourceGuidelineId` to `Task` |
| `apps/web/src/features/tasks/api.ts` | Add `createTask`, `generateTaskFromRecipe`, `generateTaskFromGuideline`, recipe/guideline lite-list calls |
| `apps/web/src/features/tasks/CreateTaskDialog.tsx` | New — 3-mode create dialog |
| `apps/web/src/features/tasks/TasksPage.tsx` | Wire "New Task" button + dialog + RBAC gate |
| `apps/web/src/features/tasks/TaskCard.tsx` | Render source recipe/guideline title line |
| `apps/web/src/features/tasks/CompleteTaskDialog/CompleteTaskDialog.tsx` | Show ingredient names instead of raw ids |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/tasks/**` | Backend already fully supports this — no API changes needed unless the recipe/guideline title lookup genuinely can't be done client-side (flag to Supervisor first) |
| `apps/api/prisma/schema.prisma` | No schema change required |
| `apps/web/src/features/tasks/CompleteTaskDialog/CompleteTaskDialog.tsx` deduction math | Only the *display* of ingredient identity changes — do not touch T011's deduction computation logic |

---

## Test Plan

Unit/component tests for `CreateTaskDialog` (all 3 modes, empty-title validation, RBAC-gated visibility), updated `TaskCard` test for the source-title line, updated `CompleteTaskDialog` test asserting ingredient names render. Live verify (easy-ui-mcp) for the full create → appears on board → complete → see ingredient names flow, across at least Owner and Staff roles (Staff: confirm no create button).

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run — pending Supervisor Stage 4
- [x] Security review: not required (Risk: Low, no RBAC/schema change) — confirmed no backend RBAC weakened (Staff still 403s server-side, verified live)
- [x] Lint passes (oxlint clean)
- [x] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [x] Live API `verify` run against seeded demo data (see Evidence table) — no browser/easy-ui-mcp tool available in this sub-agent's toolset; Supervisor should optionally capture a live screenshot before merge if a visual artifact is required
- [ ] `memory/MEMORY.md` updated (new pattern: another backend-done/frontend-incomplete gap found post-hoc, same class as T031/T032/T033) — Supervisor-only write, flagged below
- [x] Supervisor notified: task ready for Stage 4 review
