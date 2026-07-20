# TASK_GUIDE — T037: Convert all create/edit forms to the shared Dialog modal pattern

**Date**: 2026-07-20
**Complexity Level**: C3
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
5. C3 — apply the matching process (brainstorm / decompose / verify depth / model) from the Complexity matrix in `.claude/agents/general-agent-template.md`. Given this touches 5 pages, decompose into a page-by-page checklist and verify each page's tests pass before moving to the next — do not batch all 5 changes into one untested commit.
6. Read `memory/codebase-map.md` for directory layout and blast-radius hotspots

---

## Requirement (Pillar 1 — Adapt the requirement)

User request (verbatim): "for the consistent, let update all the new or edit session in the app as modal supervisor."

**Restated intent**:
> The app currently has three different create/edit UX patterns across its pages: (1) Tasks already uses a proper modal (`CreateTaskDialog`, built on the shared `Dialog` primitive); (2) Recipes and Guidelines replace the *entire page view* with a form when creating/editing (`mode === 'create' | 'edit'` swaps out the list/detail entirely); (3) Inventory, Announcements, Notes, and Team render an always-visible or toggled inline form embedded directly in the page layout (Inventory additionally has per-row inline editing). For consistency, every "new X" / "edit X" interaction in the app should open as a modal dialog using the existing `Dialog` primitive (`apps/web/src/components/Dialog/Dialog.tsx`), matching the pattern already established by `CreateTaskDialog.tsx` and `CompleteTaskDialog.tsx`.

**Out of scope**:
- Changing any backend endpoint, RBAC rule, or validation logic — this is presentation-layer only. Every page's existing WRITE_ROLES gate (or lack thereof, e.g. Notes) must be preserved exactly as-is.
- Fixing any RBAC gaps found along the way (e.g. `NotesPage.tsx` has no client-side role gate on its create form at all, relying on the backend to 403 a Viewer's `POST /notes`) — flag if found, do not silently "fix" it as a drive-by change.
- Changing which fields exist on any form, or any validation rule — only the container changes from inline/full-page to modal.
- Redesigning the `Dialog` primitive itself, unless a genuine defect blocks reuse (e.g. it currently has no built-in scroll handling for long forms — if a form's content overflows the `max-w-md` modal on a small viewport, that's an acceptable pre-existing constraint of the primitive; widening it slightly is fine if needed, but keep the change minimal and consistent for all 5 pages, not per-page bespoke sizing).
- Inventory's stock-receive flow (separate from ingredient create/edit) — only the "Add Ingredient" create form and the per-ingredient edit fields are in scope; leave `receivingId`/stock-receive UI as-is unless it's part of the same inline-edit block being converted (check the actual code before assuming).

**Requirement Refs**: No specific FR/NFR covers UI-consistency directly; this is a cross-cutting UX consistency request from the user, tracked as a standalone improvement (same category as T034's cursor-pointer consistency fix).

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor investigation: read all 6 feature pages directly — `TasksPage.tsx`/`CreateTaskDialog.tsx` [modal, reference pattern], `RecipesPage.tsx` [full-page-replace], `GuidelinesPage.tsx` [full-page-replace], `InventoryPage.tsx` [toggled inline form + per-row inline edit], `AnnouncementsPage.tsx` [always-visible inline form], `NotesPage.tsx` [always-visible inline form, no RBAC gate], `TeamPage.tsx` [always-visible inline invite form] — no guessing)
- [x] Domain terms align with `PROJECT_SPEC.md` glossary
- [ ] Every Acceptance Criterion below traces to a line in the Requirement — confirm at spawn
- [x] This is a UI-consistency request, not tied to a specific FR — tracked per the Karpathy materiality heuristic as a legitimate cross-cutting task

---

## Dependencies & Reachability

**Depends on**: None — `Dialog` primitive (`apps/web/src/components/Dialog/Dialog.tsx`) and the reference pattern (`apps/web/src/features/tasks/CreateTaskDialog.tsx`) both already exist and are live.

**Entry point**: Each page's existing "New X" / "Edit" trigger buttons (already reachable — this task changes what they open, not whether they exist). Verify post-change that each button still opens something, via the specific per-page checks in Acceptance Criteria below.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Recipes: "New Recipe" opens a modal (via `Dialog`) instead of replacing the page; "Edit" on a recipe detail also opens a modal, pre-filled | Consistency requirement |
| 2 | Guidelines: same conversion — "New Guideline" and "Edit" open modals instead of replacing the page | Consistency requirement |
| 3 | Inventory: "Add Ingredient" opens a modal instead of an inline toggled form; per-ingredient "Edit" (currently inline in the row) opens a modal instead, pre-filled with that ingredient's values | Consistency requirement |
| 4 | Announcements: the broadcast form (Owner/Chef only) opens via a "New Announcement" button + modal, instead of always rendering inline on the page | Consistency requirement |
| 5 | Notes: the create-note form opens via a "New Note" button + modal, instead of always rendering inline; existing (lack of) RBAC gating preserved exactly | Consistency requirement |
| 6 | Team: the invite-member form opens via an "Invite Member" button + modal (Owner/Admin only), instead of always rendering inline | Consistency requirement |
| 7 | Every converted modal uses the shared `Dialog` primitive (not a bespoke overlay), matching `CreateTaskDialog.tsx`'s structure: title, form fields, Cancel/Submit buttons, Escape-to-close, click-outside-to-close (inherited from `Dialog` for free) | Consistency requirement |
| 8 | All existing RBAC gates (WRITE_ROLES checks, button visibility) are preserved exactly per page — no page gains or loses write access as a side effect of this refactor | Out of scope guard, existing RBAC convention |
| 9 | Negative: existing client-side validation (required fields, min array sizes, etc.) on every converted form still blocks submission the same way it did before — this task does not touch validation logic, only the container | Out of scope guard |
| 10 | All pre-existing tests for these 6 pages are updated to reflect the modal interaction pattern (open modal → fill → submit → modal closes) rather than assuming inline rendering, and still pass | Test-plan discipline |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Owner clicks "New Recipe" | A modal opens (role="dialog"), page content behind it unchanged | automated test + live verify |
| 2 | Owner clicks "Edit" on a Guideline | A modal opens pre-filled with that guideline's data | automated test + live verify |
| 3 | Owner clicks "Add Ingredient" then submits a valid ingredient | Modal closes, new ingredient appears in the list | automated test + live verify |
| 4 | Owner clicks "Edit" on an ingredient row | A modal opens pre-filled, not an inline row-edit | automated test + live verify |
| 5 | Owner/Chef clicks "New Announcement", submits | Modal closes, announcement appears in the feed | automated test + live verify |
| 6 | Any non-Viewer clicks "New Note", submits | Modal closes, note appears in the list | automated test + live verify |
| 7 | Owner/Admin clicks "Invite Member", submits | Modal closes, invite appears in Pending Invites | automated test + live verify |
| 8 | Staff/Viewer visits Inventory/Announcements/Team | No "Add"/"New"/"Invite" button visible, same as before this change | automated test |
| 9 | Any converted form submitted with invalid input (e.g. blank required field) | Same validation error shown as before, no network call, modal stays open | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npx vitest run src/features/recipes src/features/guidelines src/features/inventory src/features/announcements src/features/notes src/features/team
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | Updated/added modal-pattern tests across all 6 pages: `apps/web/src/features/guidelines/GuidelinesPage.test.tsx` (create+edit assert `role="dialog"` open→fill→submit→close), `apps/web/src/features/recipes/RecipesPage.test.tsx` (create+edit modal, pre-fill assert), `apps/web/src/features/inventory/InventoryPage.test.tsx` (AC3 create modal, AC4 row-Edit opens pre-filled modal), `apps/web/src/features/announcements/AnnouncementsPage.test.tsx` (button-gating + modal broadcast), `apps/web/src/features/notes/NotesPage.test.tsx` (**2 new tests**: New Note modal create; New Note button unconditionally visible), `apps/web/src/features/team/TeamPage.test.tsx` (Invite Member modal). |
| Verification command run | ☑ pass | `cd apps/web && npx vitest run src/features/recipes src/features/guidelines src/features/inventory src/features/announcements src/features/notes src/features/team` → **Test Files 6 passed (6) / Tests 51 passed (51)** (was 49; +2 new Notes tests). |
| Negative cases hold | ☑ pass | Recipes "no name blocked, no POST" + "zero ingredient rows blocked" tests still green inside the modal (RecipeForm validation untouched). Guideline/Ingredient blank-title/blank-required silent no-op preserved. |
| verify | ☐ pass / ☐ fail / ☐ N/A | Deferred to reviewer — live browser verify (easy-ui-mcp @ localhost:8766) not runnable from the implementer sandbox (no MCP tool access). |
| Review scope bounded to the change's blast radius | ☑ pass | Touched only the 6 feature dirs + 2 new dialog files; `apps/api/**`, `Dialog.tsx`, `tasks/**` untouched. |
| Full smoke suite still green (no regression) | ☑ pass | `cd apps/web && npx vitest run` → **Test Files 28 passed (28) / Tests 156 passed (156)**. Note: pre-existing `tsc -b` errors in 4 must-not-touch test files (tasks/Dashboard/cursor/responsive) confirmed present on clean `develop` before this change — not introduced here. |
| **UI: Visual regression** | ☐ pass / ☐ fail / ☐ N/A | Deferred to reviewer (easy-ui-mcp). Structural basis: every converted modal renders through the shared `Dialog` primitive with the same title / Cancel(border) / Submit(bg-accent) button layout as `CreateTaskDialog`. |
| **UI: Design-system compliance** | ☐ pass / ☐ fail / ☐ N/A | Deferred to reviewer. No raw hex added; buttons/labels reuse `bg-accent`, `text-danger`, `text-muted`, `bg-surface`, `border` tokens already used by `CreateTaskDialog.tsx`. |
| **UI: Responsiveness at target viewports** | ☐ pass / ☐ fail / ☐ N/A | Deferred to reviewer. All modals inherit `Dialog`'s `w-full max-w-md p-4 sm:p-6` responsive shell unchanged; no per-page bespoke sizing added. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| All 5 pages' create modals | LLM vision / easy-ui-mcp live screenshot | Identical modal chrome across all 5 (same `Dialog` primitive, same button styling as `CreateTaskDialog`) |
| All 5 pages' edit modals (where edit exists: Recipes, Guidelines, Inventory) | easy-ui-mcp DOM assertion / screenshot | Pre-filled correctly, same chrome as create |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | No raw hex colors; reuses `bg-accent`, `border`, `text-danger`, `text-muted` etc. already used by `CreateTaskDialog.tsx` |
| Modal chrome consistency | visual diff across pages | Every modal uses `Dialog` with the same title/Cancel/Submit button layout convention |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | easy-ui-mcp / manual | Every modal usable, no horizontal scroll, matches `Dialog`'s existing `w-full max-w-md p-4 sm:p-6` responsive shell |
| Tablet (768px) | easy-ui-mcp / manual | Same |
| Desktop (1024px+) | easy-ui-mcp / manual | Same |

---

## Approach

Work page-by-page, in this order (simplest/most similar to the reference pattern first, building confidence before the trickiest one):

1. **Reference pattern review**: re-read `apps/web/src/features/tasks/CreateTaskDialog.tsx` and `apps/web/src/components/Dialog/Dialog.tsx` — this is the target shape every other page should converge toward.
2. **Guidelines** (`GuidelinesPage.tsx`): extract the existing create/edit form JSX into a new `GuidelineFormDialog.tsx` (or similarly named) wrapping it in `Dialog`. Replace the `mode === 'create' | 'edit'` full-page-replace branch with modal open/close state, keeping `mode === 'detail'`/list rendering as the page's base view.
3. **Recipes** (`RecipesPage.tsx`, `RecipeForm.tsx`): same conversion — `RecipeForm` already exists as a separable component, so this should mostly be wrapping its usage sites in `Dialog` rather than rewriting the form itself.
4. **Inventory** (`InventoryPage.tsx`): convert the toggled "Add Ingredient" inline form into a modal. Convert per-row inline editing (`editingId`/`editName`/etc.) into an edit modal opened by each row's "Edit" button, pre-filled with that row's current values — this is the biggest structural change since it currently has no separate edit-form component, just inline state.
5. **Announcements** (`AnnouncementsPage.tsx`): convert the always-visible broadcast form into a "New Announcement" button + modal.
6. **Notes** (`NotesPage.tsx`): convert the always-visible create form into a "New Note" button + modal. Preserve the current lack of client-side RBAC gate exactly (do not add one).
7. **Team** (`TeamPage.tsx`): convert the always-visible invite form into an "Invite Member" button + modal.
8. For each page, update its existing test file to open the modal before interacting with form fields, and add/adjust assertions for modal-open/modal-close behavior. Run that page's tests before moving to the next page (per the C3 decomposition note above) — do not defer all testing to the end.

---

## Edge Case Checklist

- [ ] Escape key and click-outside-to-close (inherited from `Dialog`) don't accidentally discard an in-progress edit without any confirmation — check whether the existing `CreateTaskDialog` has this same behavior (it does, per `Dialog`'s `onClick={onClose}` on the overlay) and match it exactly; do not add a new "unsaved changes" guard that Tasks doesn't have (would be its own inconsistency)
- [ ] Inventory's edit modal must correctly pre-fill from the specific row clicked, not stale state from a previously-closed edit modal
- [ ] Opening a second page's modal while a first is still submitting (rapid double-click across different rows/pages) — each page's existing `disabled={submitting}` guard on submit buttons should already prevent double-submit; confirm it still applies inside the modal
- [ ] Announcements/Team: WRITE_ROLES-gated "New X" button must not render at all for non-writers, same as it does today (currently the form itself is hidden via a role check — confirm the button-gating logic is preserved 1:1, not accidentally inverted)
- [ ] Notes: any role (including Viewer) currently sees the create form — confirm the "New Note" button is visible to everyone too (matching current behavior), not accidentally RBAC-gated as part of this refactor

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/guidelines/GuidelinesPage.tsx` | Modal conversion |
| `apps/web/src/features/guidelines/GuidelineFormDialog.tsx` (new, or similar name) | Extracted form, wrapped in `Dialog` |
| `apps/web/src/features/recipes/RecipesPage.tsx` | Modal conversion (wrap existing `RecipeForm` usage) |
| `apps/web/src/features/inventory/InventoryPage.tsx` | Modal conversion (create + per-row edit) |
| `apps/web/src/features/inventory/IngredientFormDialog.tsx` (new, or similar name) | Extracted create/edit form, wrapped in `Dialog` |
| `apps/web/src/features/announcements/AnnouncementsPage.tsx` | Modal conversion |
| `apps/web/src/features/notes/NotesPage.tsx` | Modal conversion |
| `apps/web/src/features/team/TeamPage.tsx` | Modal conversion |
| Corresponding `*.test.tsx` files for all 6 pages | Updated for modal-open interaction pattern |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | Presentation-only change, no backend touch |
| `apps/web/src/components/Dialog/Dialog.tsx` | Reuse as-is; only touch if a genuine blocking defect is found, and keep any such change minimal and applied identically for all 5 pages |
| `apps/web/src/features/tasks/**` | Already uses the target pattern (`CreateTaskDialog`/`CompleteTaskDialog`) — reference only, not to be modified |
| Any RBAC/validation logic in any of the 6 pages | Container-only change; do not alter who can write or what's required |

---

## Test Plan

Per-page component tests updated to: click the "New X"/"Edit" trigger, assert a `role="dialog"` element appears, interact with fields inside it, submit, assert the modal closes and the expected list/detail update happened. RBAC tests (non-writer sees no trigger button) preserved. Live verify (easy-ui-mcp) across at least 2 pages representative of the two hardest conversions (Inventory's per-row edit, and one full-page-replace page) to visually confirm modal chrome consistency, plus a Staff-role pass confirming no regressions to existing RBAC-gated buttons.

---

## Completion Checklist

- [ ] Implementation done for all 5 pages (Recipes, Guidelines, Inventory, Announcements, Notes, Team)
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required (Risk: Medium is from blast-radius size, not RBAC/schema change — no security-review needed per Stage 4 gating rules, confirm with Supervisor if unsure)
- [ ] Lint passes
- [ ] Tests written/updated AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` / live browser verify run — feature confirmed working in running app, across at least Inventory and one other page
- [ ] `memory/MEMORY.md` updated (records the app-wide modal-consistency convention as the new default for any future create/edit UI)
- [ ] Supervisor notified: task ready for Stage 4 review
