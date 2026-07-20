# TASK_GUIDE — T036: Recipes Page (list + detail + create/edit, cost roll-up)

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

Follow-up from T035's investigation: Recipe CRUD (T005) is fully built and live on the backend (`GET/POST/PATCH /recipes`, `GET /recipes/:id/versions`), with auto-computed cost roll-up — but **no `apps/web/src/features/recipes/` directory or route exists at all**. This is the same "backend done, frontend never built" gap already closed for Inventory (T031), Guidelines (T032), Announcements (T033), and Tasks (T035) — Recipes is the last of the core domain models still missing its page. Confirmed by Supervisor code read (`apps/api/src/recipes/recipes.controller.ts`, `recipes.service.ts`, `schema.prisma` lines 163–179) before writing this guide, not guessed.

**Restated intent**:
> Users need a Recipes page: list existing recipes, view a recipe's detail (steps, ingredients, computed cost), and (for Owner/Admin/Chef) create/edit a recipe with a name, ordered steps, servings, and an ingredients builder (ingredient + qty, cost computed live from `Ingredient.costPerUnit`). This also gives T035's "Generate from Recipe" flow a real page to link to, and unblocks a future "view recipe from task" navigation.

**Out of scope**:
- Fields mentioned in `PRD.md` FR-001 (category, unit override, yield, prep/cook time, photo, allergens) that **don't exist on the current `Recipe`/`RecipeIngredient` Prisma models** — the backend only stores `name`, `steps[]`, `servings`, `version`, and `ingredients[{ingredientId, qty}]` (unit is read from the linked `Ingredient`, not stored per-recipe-line). Do not invent frontend-only fields with no backend field to persist them — if this gap matters, it needs a separate backend task first. Flag this discrepancy in the PR/commit but do not silently add fake fields.
- Recipe deletion — no `DELETE /recipes/:id` endpoint exists; do not add a delete button.
- Version history UI (`GET /recipes/:id/versions` exists on the backend) — display is optional/nice-to-have here, not required for Done. If time allows, a simple version list is welcome but not gating.
- CSV export UI — `GET /export/recipes` already exists (FR-023) but wiring an export button is a separate small follow-up, not required here.
- Linking a Task's "From: <title>" line to actually navigate to the Recipe/Guideline detail page — T035 only shows the title as text; making it a clickable link to this new Recipes page is a nice-to-have, flag if time allows but not gating.

**Requirement Refs** (from `PRD.md`):
- US-001: Head Chef wants to create a recipe with ingredients and steps so cost is computed automatically.
- FR-001 (partial — see Out of Scope for the fields not backed by the current schema): create/edit a Recipe with name, ingredients, steps.
- FR-002: System must auto-compute a Recipe's estimated cost from its RecipeIngredient list × Ingredient cost_per_unit — already computed server-side (`RecipesService#computeCost`), this task only needs to display `costComputed`.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor investigation, direct code read of controller/service/schema — no guessing)
- [x] Domain terms align with `PROJECT_SPEC.md` glossary (Recipe, RecipeIngredient, Ingredient, cost_computed all existing confirmed domain models)
- [ ] Every Acceptance Criterion below traces to a line in the Requirement — confirm at spawn
- [x] All Requirement Refs exist in `PRD.md` (US-001, FR-001 partial, FR-002)

---

## Dependencies & Reachability

**Depends on**: None — `GET /recipes`, `GET /recipes/:id`, `POST /recipes`, `PATCH /recipes/:id`, `GET /recipes/:id/versions` all already exist and are live.

**Entry point**: `<RecipesPage>` (new route, add to `apps/web/src/App.tsx` and a "Recipes" link in `apps/web/src/layout/Sidebar.tsx` — same pattern as Inventory/Guidelines/Announcements)

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A "Recipes" nav link appears in the sidebar for all roles and routes to `/recipes` | Entry point, US-001 |
| 2 | Recipes list page shows each recipe's name, servings, and computed cost, fetched from `GET /recipes` | US-001, FR-002 |
| 3 | Clicking a recipe opens a detail view showing steps (ordered), ingredients (name, qty, unit, line cost), and total computed cost | US-001, FR-002 |
| 4 | Owner/Admin/Chef see a "New Recipe" button; Staff/Viewer do not (same WRITE_ROLES RBAC shape as Inventory/Guidelines/Tasks) | FR-018 (existing RBAC convention) |
| 5 | Create form: name (required), servings (optional), steps (add/remove ordered list), ingredients builder (pick an Ingredient from a dropdown + qty, add/remove rows, at least 1 required) — posts to `POST /recipes` | US-001, FR-001 (schema-backed fields only) |
| 6 | Edit form (WRITE_ROLES only): same fields, pre-filled, posts to `PATCH /recipes/:id` | FR-001 |
| 7 | Negative: submitting create with no name, or zero ingredient rows, is blocked client-side with a visible validation message, no network call made | FR-001 boundary case (mirrors backend's `ArrayMinSize(1)` on ingredients and `MinLength(1)` on name) |
| 8 | Negative: a Staff/Viewer user hitting `POST /recipes` directly still gets rejected server-side (confirm existing RBAC isn't weakened, don't just trust UI-hiding) | FR-018 |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Owner navigates to Recipes | List of seeded recipes with name/servings/cost shown | automated test + live verify |
| 2 | Owner clicks a recipe | Detail view shows steps, ingredients with names/qty/unit/line-cost, total cost | automated test + live verify |
| 3 | Owner creates a recipe with 1 step, 1 ingredient | New recipe appears in the list with computed cost | automated test + live verify |
| 4 | Owner edits an existing recipe's servings | `PATCH /recipes/:id` fires, updated value reflected | automated test |
| 5 | Create form submitted with no name / zero ingredients | Inline validation error(s), no `POST /recipes` call | automated test |
| 6 | Staff views Recipes page | No "New Recipe" button; recipe list still viewable (read-only) | automated test |
| 7 | Staff-token `POST /recipes` (direct API probe) | `403` | live curl probe |

### Verification Command (exact, runnable)

```bash
cd apps/web && npx vitest run src/features/recipes
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/recipes/RecipesPage.test.tsx` (10 tests: AC2 list, AC3 detail, AC4/AC5 create+RBAC, AC6 edit, AC7 blank-name/zero-ingredient validation, AC4 Staff hides create/edit, empty-state, error-surfacing); `apps/web/src/App.test.tsx` (AC1 route-mount test). `npx vitest run src/features/recipes src/App.test.tsx` → 2 files, 21/21 pass. |
| Verification command run | ☒ pass | `cd apps/web && npx vitest run src/features/recipes` → `Test Files 1 passed (1) Tests 10 passed (10)`. Full FE suite: `npx vitest run` → `Test Files 28 passed (28) Tests 154 passed (154)`. `npx tsc --noEmit` clean. |
| Negative cases hold | ☒ pass | AC7 (blank name / zero ingredients blocked client-side, no POST fires) covered in tests; AC8 confirmed live: `curl -X POST /recipes` with a Staff token → `403` (Supervisor-run, see verify row). |
| verify | ☒ pass | Supervisor live browser session (easy-ui-mcp) + curl probes against the running app: Owner navigated to `/recipes`, opened a seeded recipe's detail (steps + ingredients table + total cost all rendered), created a new recipe ("Verify Test Recipe") which appeared in the list. Logged in as Staff: no "New Recipe" button, list still viewable (read-only), confirmed via DOM assertion. `curl` confirmed `GET /recipes[0].costComputed` is a real JSON `float` (10.35), not a stringified Decimal — resolves the Stage 4 P2 concern about `.toFixed(2)` safety. Staff-token `POST /recipes` → `403`, confirming backend RBAC unweakened. Report archived at `reports/evidence/T036/session-62216f9c-ce90-407b-ae96-45ebe683eaea.{json,html}` (session harness marked "failed" due to one intermediate selector-ambiguity retry mid-session — not a functional failure; every subsequent assertion in the same session passed, confirmed by the explicit pass/fail asserts above). |
| Review scope bounded to the change's blast radius | ☒ pass | Diff confined to `apps/web/src/features/recipes/**` (new) plus `App.tsx`/`App.test.tsx`/`navigation.ts` (route wiring, same pattern as T031/T032/T033/T035). No `apps/api/**` or `schema.prisma` touched. |
| Full smoke suite still green (no regression) | ☒ pass | `npx vitest run` (full apps/web suite) → `Test Files 28 passed (28) Tests 154 passed (154)`, no regressions elsewhere. |
| **UI: Visual regression** | ☒ pass | `RecipesPage` reuses the list+detail pattern already established by `GuidelinesPage.tsx`; `RecipeForm.tsx` reuses the create-form conventions from `GuidelinesPage`/`InventoryPage`. Live-verified: list, detail, and create form all render correctly with no visual anomalies. |
| **UI: Design-system compliance** | ☒ pass | No raw hex colors — reuses `bg-accent`, `text-white`, `border`, `bg-surface-raised`, `text-danger`, `text-muted` tokens already used elsewhere. |
| **UI: Responsiveness at target viewports** | ☒ pass | Same `p-6`/`flex flex-wrap gap-3` responsive shell as Guidelines/Inventory pages (already verified at mobile/tablet/desktop in T021's mobile responsive pass) — no new fixed-width elements introduced. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Recipes list page | LLM vision / easy-ui-mcp live screenshot | Matches existing Inventory/Guidelines list-page conventions |
| Recipe detail view | easy-ui-mcp DOM assertion / screenshot | Steps ordered list, ingredients table, cost total all rendered |
| Create/Edit Recipe form | easy-ui-mcp DOM assertion / screenshot | Matches existing GuidelinesPage/InventoryPage create-form conventions |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Reuses existing `bg-accent`/`border`/`text-muted`/`text-danger` tokens — no new raw colors |
| Typography matches spec | visual | Consistent with GuidelinesPage/InventoryPage |
| Spacing / layout matches spec | visual | Consistent with existing page conventions |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | easy-ui-mcp / manual | List, detail, and create form usable, no horizontal scroll |
| Tablet (768px) | easy-ui-mcp / manual | Same |
| Desktop (1024px+) | easy-ui-mcp / manual | Same |

---

## Approach

1. New `apps/web/src/features/recipes/` directory, mirroring `apps/web/src/features/guidelines/` structure (list page + detail view + create/edit form, `api.ts`, `types.ts`).
2. `types.ts`: `Recipe { id, name, steps: string[], servings: number | null, version, costComputed, ingredients: { ingredientId, name, unit, qty, costPerUnit, lineCost }[] }` — match the actual `RecipesService#serialize` response shape (read it directly, don't guess field names).
3. `api.ts`: `listRecipes()`, `getRecipe(id)`, `createRecipe(dto)`, `updateRecipe(id, dto)` using the existing `request<T>()`/`notifyApiError` pattern (T029-wired), same as other feature `api.ts` files.
4. `RecipesPage.tsx`: list + detail (can be a single page with a selected-recipe panel, mirroring `GuidelinesPage.tsx`'s list+detail pattern) + "New Recipe" button gated on WRITE_ROLES.
5. `RecipeForm.tsx` (shared by create/edit): name input, servings input, steps list (add/remove/reorder optional — add/remove is sufficient), ingredients builder (dropdown sourced from `GET /ingredients` — reuse `listIngredients` from `apps/web/src/features/inventory/api.ts` like T035 did — + qty input + add/remove row), client-side validation mirroring the backend DTO (`MinLength(1)` name, `ArrayMinSize(1)` ingredients).
6. Wire into `apps/web/src/App.tsx` (route) and `apps/web/src/layout/Sidebar.tsx` (nav link) — follow the exact pattern used for `/guidelines`/`/inventory`.
7. Optional, if time allows: make T035's `TaskCard`/`ListView` "From: <title>" line a link to `/recipes/:id` or `/guidelines/:id` when the target page exists — flag this as a suggestion in your report, do not treat as required for Done.

---

## Edge Case Checklist

- [ ] Recipe with zero recipes seeded yet — list page shows an empty state, not a crash
- [ ] Ingredient picker (in the create/edit form) is empty (no ingredients exist) — helpful empty state, "New Recipe" effectively unusable until Inventory has ingredients; don't crash
- [ ] Recipe references an ingredient that's since been deleted — `computeCost` behavior on the backend for this case; check `RecipesService#computeCost`'s handling before assuming, and don't crash the detail view if a resolved ingredient is missing
- [ ] Rapid double-submit of create/edit form — disable submit while in flight (same pattern as other create forms)
- [ ] Staff/Viewer navigates directly to a create/edit URL (if using nested routes) — must not expose the form even via direct URL, not just hide the button

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/recipes/types.ts` | New |
| `apps/web/src/features/recipes/api.ts` | New |
| `apps/web/src/features/recipes/RecipesPage.tsx` | New |
| `apps/web/src/features/recipes/RecipeForm.tsx` | New |
| `apps/web/src/App.tsx` | Add `/recipes` route |
| `apps/web/src/layout/Sidebar.tsx` | Add "Recipes" nav link |
| `apps/web/src/features/tasks/TaskCard.tsx` / `ListView.tsx` | Optional — link "From: <title>" to the new Recipes/Guidelines detail route, only if time allows |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/recipes/**` | Already fully supports this — no API changes needed |
| `apps/api/prisma/schema.prisma` | No schema change required; do not add FR-001's unbacked fields (category/photo/allergens/prep-time) without a separate deliberate backend task |
| T035's Task-completion deduction math (`apps/web/src/features/tasks/CompleteTaskDialog/**`) | Out of scope, unrelated to this task |

---

## Test Plan

Unit/component tests for `RecipesPage` (list rendering, detail view, RBAC-gated create button, Staff sees no create button), `RecipeForm` (create + edit modes, name/ingredients validation, add/remove step and ingredient rows). Live verify (easy-ui-mcp) for the full list → detail → create → appears in list flow, plus a Staff-role probe confirming no create access (UI-hidden) and a curl probe confirming the backend still 403s.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required (Risk: Low, no RBAC/schema change)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` / live browser verify run — feature confirmed working in running app
- [ ] `memory/MEMORY.md` updated (closes the last of the T031/T032/T033/T035-class "backend done, frontend missing" gaps across all core domain models)
- [ ] Supervisor notified: task ready for Stage 4 review
