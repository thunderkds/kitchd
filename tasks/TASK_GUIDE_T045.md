# TASK_GUIDE — T045: Expiring-soon widget
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
6. This task is C1 and a small multi-file widget slice, so `memory/codebase-map.md` is optional

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: `docs/audits/backend-frontend-coverage_2026-07-28.md`, finding F3.

**Restated intent**:
> Surface the existing expiring-soon inventory alert data on the Dashboard with a small widget, so kitchen staff can see which stock batches are nearing expiry without leaving the home page.

**Out of scope**:
- No alert threshold configuration UI
- No backend contract changes
- No navigation/sidebar changes

**Requirement Refs**:
- Audit F3: expiring-soon alerts are unreachable

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the request
- [x] Domain terms align with `PROJECT_SPEC.md`
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] All Requirement Refs exist in the audit and are covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: None

**Entry point**: `/dashboard`

**Consumer**: `Dashboard` widget grid

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Dashboard renders a new expiring-soon widget that fetches `GET /inventory/alerts/expiring` on mount | "surface the existing expiring-soon inventory alert data" |
| 2 | When the endpoint returns batches, the widget shows a readable list using the existing low-stock widget pattern for loading/error/empty states | "small widget" / reuse working template |
| 3 | The Dashboard layout remains intact on small and large screens, with the new widget not breaking the grid | "on the Dashboard" |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged-in user opens `/dashboard` | Expiring-soon widget appears and requests the alert endpoint | automated test |
| 2 | Endpoint returns batches / empty list / error | Widget renders list / empty state / error state | automated test |
| 3 | Dashboard renders on mobile and desktop | Layout stays readable with the new widget in the grid | browser/screenshot check |

### Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/web exec vitest run src/components/ExpiringSoonWidget/ExpiringSoonWidget.test.tsx src/pages/Dashboard/Dashboard.test.tsx && pnpm --filter @kitchenos/web run build
```

### Evidence (filled by reviewer at Stage 4/5)

> Moved.

---

## Demonstration

> Moved. See `tasks/TASK_REVIEW_T045.md`.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `Dashboard` expiring-soon widget | screenshot / browser check | Card matches the existing widget language and is readable in both themes |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | screenshot / code review | Uses semantic tokens such as `bg-surface-raised`, `text-primary`, `text-muted`, and status tones where needed |
| Typography matches spec | screenshot | Same text scale as the low-stock widget / other dashboard widgets |
| Spacing / layout matches spec | screenshot | Reuses the existing card padding and gap conventions |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|------------------|
| Mobile (320-480px) | screenshot | Widget stacks without horizontal overflow |
| Tablet (768px) | screenshot | Widget remains legible in the grid |
| Desktop (1024px+) | screenshot | Widget sits naturally beside the other dashboard cards |

---

## Approach

**Pattern reference**: `apps/web/src/components/LowStockWidget/LowStockWidget.tsx` and `apps/web/src/components/LowStockWidget/api.ts`

**Vital slice**: read-only expiring-soon list widget on the Dashboard

**Cut list**:
- No filter controls
- No inline batch actions
- No new alerts page

Keep the implementation self-contained: a tiny API helper plus a widget component, then wire it into the Dashboard grid.

---

## Edge Case Checklist

- [ ] Endpoint returns no batches
- [ ] Endpoint returns an error
- [ ] Batch has a null expiry date and must not appear
- [ ] Dashboard still renders cleanly with the new card in the grid

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/components/ExpiringSoonWidget/api.ts` | Add authenticated fetch helper for `GET /inventory/alerts/expiring` |
| `apps/web/src/components/ExpiringSoonWidget/ExpiringSoonWidget.tsx` | New dashboard widget component |
| `apps/web/src/components/ExpiringSoonWidget/ExpiringSoonWidget.test.tsx` | Cover loading, empty, error, and populated states |
| `apps/web/src/pages/Dashboard/Dashboard.tsx` | Add the widget to the dashboard grid |
| `apps/web/src/pages/Dashboard/Dashboard.test.tsx` | Assert the dashboard renders the new widget |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/inventory/alerts/*` | Backend endpoint already exists and is out of scope |
| `PRD.md` | Protected source-of-truth product doc |

---

## Test Plan

1. Add the widget API/component tests first.
2. Update Dashboard tests to assert the widget is present.
3. Run the targeted vitest slice and the web build.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Tests written AND pass
- [ ] `npm run build` / web build passes
- [ ] Supervisor notified: task ready for Stage 4 review
