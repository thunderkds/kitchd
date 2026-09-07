# TASK_GUIDE — T044: Shift Log page + sidebar entry
**Date**: 2026-09-07
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
5. Note the **Complexity Level** above and apply the matching process from the role guide
6. This task is C2 and a new page + nav slice, so `memory/codebase-map.md` is optional but useful

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: `docs/audits/backend-frontend-coverage_2026-07-28.md`, finding F2.

**Restated intent**:
> Surface the existing Shift Log feed on its own page and add it to the main navigation so kitchen staff can read and author shift handoffs from the web app.

**Out of scope**:
- No analytics/dashboard widgets
- No backend contract changes
- No timeline/calendar view

**Requirement Refs**:
- Audit F2: Shift Log module is unreachable

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the request
- [x] Domain terms align with `PROJECT_SPEC.md`
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] All Requirement Refs exist in the audit and are covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: None

**Entry point**: `/shift-logs`

**Consumers**: `Sidebar`, `ShiftLogsPage`

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | The main sidebar includes a Shift Log entry that navigates to `/shift-logs` | "add it to the main navigation" |
| 2 | The Shift Log page fetches `GET /shift-logs` on mount and renders the feed in newest-first order | "surface the existing Shift Log feed" |
| 3 | Write-capable roles can create a shift log entry via `POST /shift-logs`, and Viewer does not see the write control | "read and author shift handoffs" / existing RBAC |
| 4 | The page clearly shows the shift, body, and creation time for each entry, and remains readable on the existing layout | "read shift handoffs" |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Authenticated user opens the app | Shift Log appears in the sidebar and routes to the new page | automated test |
| 2 | The Shift Log page loads | The list appears and requests the feed endpoint | automated test |
| 3 | Writer submits a shift log | The new entry appears without a page reload | automated test |
| 4 | Viewer opens the page | No create control is shown | automated test |

### Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/web exec vitest run src/features/shift-logs/ShiftLogsPage.test.tsx src/features/shift-logs/api.test.tsx src/layout/navigation.test.tsx && pnpm --filter @kitchenos/web run build
```

### Evidence (filled by reviewer at Stage 4/5)

> Moved.

---

## Demonstration

> Moved. See `tasks/TASK_REVIEW_T044.md`.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Shift Log page | screenshot / browser check | Feed and create control match the existing page language and remain readable in both themes |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | screenshot / code review | Uses the same semantic surfaces and text tokens as nearby list pages |
| Typography matches spec | screenshot | Shift label, body, and timestamp use the existing page text scale |
| Spacing / layout matches spec | screenshot | Rows stack cleanly and the header actions align with the shared layout |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|------------------|
| Mobile (320-480px) | screenshot | Feed rows and the create button stack without overflow |
| Tablet (768px) | screenshot | Page remains legible in the app shell |
| Desktop (1024px+) | screenshot | Page uses the available content width naturally |

---

## Approach

**Pattern reference**: `apps/web/src/features/notes/NotesPage.tsx` and `apps/web/src/features/announcements/AnnouncementsPage.tsx`

**Vital slice**: a read/write shift-log feed on its own page, reachable from the sidebar

**Cut list**:
- No sidebar badge/count
- No search/filter UI beyond the initial feed
- No inline edit/delete actions

Keep the implementation small: one shift-log API module, one page component, a nav update, and tests for the route, list, and create flow.

---

## Edge Case Checklist

- [ ] Feed is empty
- [ ] Feed request fails
- [ ] Viewer sees the feed but not the create control
- [ ] Write-capable user can post a MORNING or EVENING entry only

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/shift-logs/api.ts` | Add authenticated fetch/create helpers for `GET/POST /shift-logs` |
| `apps/web/src/features/shift-logs/types.ts` | Add frontend types for shift-log feed entries |
| `apps/web/src/features/shift-logs/ShiftLogsPage.tsx` | New page component for the shift-log feed |
| `apps/web/src/features/shift-logs/ShiftLogsPage.test.tsx` | Cover list, create, empty, error, and viewer-gating behavior |
| `apps/web/src/features/shift-logs/api.test.tsx` | Cover the helper behavior and error path |
| `apps/web/src/layout/navigation.ts` | Add the Shift Log nav entry |
| `apps/web/src/App.tsx` | Wire the `/shift-logs` route |
| `apps/web/src/layout/navigation.test.tsx` | Assert the nav includes Shift Log |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/shift-logs/*` | Backend contract already exists and is out of scope |
| `PRD.md` | Protected source-of-truth product doc |

---

## Test Plan

1. Add the shift-log API helper and its unit tests.
2. Add the page and navigation tests first, then wire the route/nav entry.
3. Run the targeted vitest slice and the web build.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Tests written AND pass
- [ ] `npm run build` / web build passes
- [ ] Supervisor notified: task ready for Stage 4 review
