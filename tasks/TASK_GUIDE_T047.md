# TASK_GUIDE — T047: Recipe version history UI
**Date**: 2026-09-07
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P2
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
6. This task is C1 and a small detail-view slice, so `memory/codebase-map.md` is optional

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: `docs/audits/backend-frontend-coverage_2026-07-28.md`, finding F5.

**Restated intent**:
> Surface the existing recipe version history on the Recipes detail view so kitchen staff can inspect prior saved versions without leaving the page.

**Out of scope**:
- No backend contract changes
- No comparison/diff UI
- No separate version-history route

**Requirement Refs**:
- Audit F5: recipe version history is invisible

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the request
- [x] Domain terms align with `PROJECT_SPEC.md`
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] All Requirement Refs exist in the audit and are covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: None

**Entry point**: `/recipes`

**Consumer**: `RecipesPage` detail view

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Opening a recipe detail view fetches `GET /recipes/:id/versions` and renders the saved version history | "surface the existing recipe version history" |
| 2 | The version history is readable, shows each version in descending order, and includes useful snapshot fields such as version number, saved date, servings, and cost snapshot | "version history" / "inspect prior saved versions" |
| 3 | Existing recipe list and detail behavior stays intact while the version history section is added | "without leaving the page" |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | User opens `/recipes` and clicks a recipe | The detail view shows a version-history section that requests the versions endpoint | automated test |
| 2 | Backend returns multiple versions | UI shows a readable reverse-chronological list of version snapshots | automated test |
| 3 | List view / detail view still render normally | Existing recipe page behavior remains intact | automated test |

### Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/web exec vitest run src/features/recipes/RecipesPage.test.tsx src/features/recipes/api.test.tsx && pnpm --filter @kitchenos/web run build
```

### Evidence (filled by reviewer at Stage 4/5)

> Moved.

---

## Demonstration

> Moved. See `tasks/TASK_REVIEW_T047.md`.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Recipes detail version history | screenshot / browser check | Section fits the existing detail layout and remains readable in both themes |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | screenshot / code review | Uses the same semantic surface/text tokens as the rest of the Recipes detail view |
| Typography matches spec | screenshot | Version rows use the same text scale as nearby recipe metadata |
| Spacing / layout matches spec | screenshot | History rows align with the existing detail padding and gap conventions |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|------------------|
| Mobile (320-480px) | screenshot | Version history stacks without overflow |
| Tablet (768px) | screenshot | History remains legible below the recipe content |
| Desktop (1024px+) | screenshot | History reads naturally beside the rest of the detail content |

---

## Approach

**Pattern reference**: `apps/web/src/features/recipes/RecipesPage.tsx` and `apps/api/src/recipes/recipes.service.ts`

**Vital slice**: a read-only version-history section on the existing recipe detail view

**Cut list**:
- No side-by-side diff between versions
- No edit/revert controls
- No dedicated version page or route

Keep the implementation small: add a typed versions fetch helper, render the history inside the existing detail view, then extend the RecipesPage tests to cover the new endpoint and rendering.

---

## Edge Case Checklist

- [ ] Recipe has only version 1
- [ ] Recipe has multiple historical versions
- [ ] Version list fetch fails and surfaces the existing error path
- [ ] Detail view still renders if the version list is empty

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/recipes/api.ts` | Add authenticated helper for `GET /recipes/:id/versions` |
| `apps/web/src/features/recipes/types.ts` | Add frontend type(s) for recipe version snapshots |
| `apps/web/src/features/recipes/RecipesPage.tsx` | Render the version history in the recipe detail view |
| `apps/web/src/features/recipes/RecipesPage.test.tsx` | Cover detail rendering, version-history fetch, and the new history section |
| `apps/web/src/features/recipes/api.test.tsx` | Cover the versions helper and error path |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/recipes/*` | Backend contract already exists and is out of scope |
| `PRD.md` | Protected source-of-truth product doc |

---

## Test Plan

1. Add the versions API helper and its unit tests.
2. Render the version history in the recipe detail view.
3. Update the Recipes page tests and run the targeted vitest slice plus the web build.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Tests written AND pass
- [ ] `npm run build` / web build passes
- [ ] Supervisor notified: task ready for Stage 4 review
