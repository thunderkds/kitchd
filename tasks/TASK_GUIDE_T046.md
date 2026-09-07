# TASK_GUIDE — T046: CSV export controls
**Date**: 2026-09-07
**Complexity Level**: C1
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
5. Note the **Complexity Level** above and apply the matching process from the role guide
6. This task is C1 and a small multi-file UI slice, so `memory/codebase-map.md` is optional

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: `docs/audits/backend-frontend-coverage_2026-07-28.md`, finding F4.

**Restated intent**:
> Surface the existing CSV export endpoints on the Inventory and Recipes pages so kitchen staff can download ingredient and recipe data without leaving the app.

**Out of scope**:
- No backend contract changes
- No new export page or route
- No format selector or export customization UI

**Requirement Refs**:
- Audit F4: CSV export is unreachable

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the request
- [x] Domain terms align with `PROJECT_SPEC.md`
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] All Requirement Refs exist in the audit and are covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: None

**Entry points**: `/inventory`, `/recipes`

**Consumers**: `InventoryPage`, `RecipesPage`

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | The Inventory page renders a CSV export control for ingredients that fetches `GET /export/ingredients` and downloads a CSV file when activated | "Surface the existing CSV export endpoints" |
| 2 | The Recipes page renders a CSV export control for recipes that fetches `GET /export/recipes` and downloads a CSV file when activated | "Surface the existing CSV export endpoints" |
| 3 | Export controls are only available to the same write-capable roles that already manage these pages, and non-managers do not trigger export requests | "surface the existing CSV export endpoints" / match existing role-gated page behavior |
| 4 | The existing Inventory and Recipes layouts remain intact, including loading and empty states, after the export controls are added | "without leaving the app" / preserve current page surfaces |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged-in write-capable user opens `/inventory` | An export control is visible and requests the ingredients export endpoint | automated test |
| 2 | Logged-in write-capable user opens `/recipes` | An export control is visible and requests the recipes export endpoint | automated test |
| 3 | Non-writer role opens either page | Export controls are hidden and no export request fires | automated test |
| 4 | Both pages render normally | Existing layout, loading, and empty-state behavior still pass | automated test |

### Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/web exec vitest run src/features/inventory/InventoryPage.test.tsx src/features/recipes/RecipesPage.test.tsx src/features/export/api.test.tsx && pnpm --filter @kitchenos/web run build
```

### Evidence (filled by reviewer at Stage 4/5)

> Moved.

---

## Demonstration

> Moved. See `tasks/TASK_REVIEW_T046.md`.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Inventory export control | screenshot / browser check | Button fits the existing page header action area and is readable in both themes |
| Recipes export control | screenshot / browser check | Button matches the existing Recipes page action language and spacing |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | screenshot / code review | Uses the same semantic button styles as nearby actions on each page |
| Typography matches spec | screenshot | Button text matches the page action scale |
| Spacing / layout matches spec | screenshot | Header action row remains aligned and wraps cleanly on small screens |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|------------------|
| Mobile (320-480px) | screenshot | Header actions wrap without overflow |
| Tablet (768px) | screenshot | Export control remains usable beside the existing page actions |
| Desktop (1024px+) | screenshot | Export control sits naturally with the page header actions |

---

## Approach

**Pattern reference**: `apps/web/src/features/inventory/InventoryPage.tsx` and `apps/web/src/features/recipes/RecipesPage.tsx`

**Vital slice**: write-capable export buttons in the two page headers, backed by one small authenticated download helper

**Cut list**:
- No export history page
- No file naming customization
- No background export job or polling

Keep the implementation small: one shared helper for authenticated CSV download, then wire the buttons into the Inventory and Recipes headers.

---

## Edge Case Checklist

- [ ] Export request fails and shows the existing error surface
- [ ] Non-writer roles do not see or trigger export controls
- [ ] Download preserves the filename returned by the server when available
- [ ] Page headers still wrap cleanly on narrow screens

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/export/api.ts` | Add authenticated CSV download helper(s) for the export endpoints |
| `apps/web/src/features/export/api.test.tsx` | Cover the download helper behavior and failure path |
| `apps/web/src/features/inventory/InventoryPage.tsx` | Add the ingredients export control to the header |
| `apps/web/src/features/inventory/InventoryPage.test.tsx` | Assert the export control renders and triggers the helper for write-capable users |
| `apps/web/src/features/recipes/RecipesPage.tsx` | Add the recipes export control to the header |
| `apps/web/src/features/recipes/RecipesPage.test.tsx` | Assert the export control renders and triggers the helper for write-capable users |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/export/*` | Backend contract already exists and is out of scope |
| `PRD.md` | Protected source-of-truth product doc |

---

## Test Plan

1. Add the authenticated CSV download helper and its unit tests.
2. Wire the controls into Inventory and Recipes, with page tests for both.
3. Run the targeted vitest slice and the web build.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Tests written AND pass
- [ ] `npm run build` / web build passes
- [ ] Supervisor notified: task ready for Stage 4 review
