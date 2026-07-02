# TASK_GUIDE — T018: Home dashboard aggregation
**Date**: 2026-07-02
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P0
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. C1 task — codebase-map read not required

---

## Requirement (Pillar 1 — Adapt the requirement)

Give the chef/staff one place to see everything that matters right now — the Taskade-style workspace overview.

**Restated intent**:
> The Dashboard composes today's Tasks (T008), low-stock alerts (T007), latest Announcements (T013), and pinned Notes (T012) into one role-aware page loading under 1.5s p95.

**Out of scope**:
- Building any of the four underlying data sources (already built in T007/T008/T012/T013) — this task only composes them

**Requirement Refs**:
- FR-020, US-012, NFR-001

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Dashboard loads all four widgets from their respective endpoints | FR-020 |
| 2 | A Staff-role user's Dashboard shows only their assigned Tasks; a Chef-role user sees all Kitchen Tasks | US-012 |
| 3 | Page load completes under 1.5s p95 in local dev testing (measured) | NFR-001 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Load /dashboard as Staff | Only own Tasks widget populated | E2E test |
| 2 | Load /dashboard as Chef | Full ops view, all widgets populated | E2E test |
| 3 | Measure dashboard load time over N repeated loads | p95 < 1.5s | performance measurement, pasted timing output |
| 4 | Kitchen with zero data in any widget | Empty state shown, not a broken layout | E2E test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/web run test -- dashboard
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| **UI: Visual regression** | ☐ pass / ☐ fail | Dashboard screenshots, Staff vs Chef view |
| **UI: Design-system compliance** | ☐ pass / ☐ fail | |
| **UI: Responsiveness** | ☐ pass / ☐ fail | |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Dashboard (Chef view) | MCP screenshot (Playwright MCP) | 4-widget grid: Tasks, Low Stock, Announcements, Pinned Notes |
| Dashboard (Staff view) | MCP screenshot (Playwright MCP) | Scoped "my tasks today" variant |
| Dashboard (empty state) | MCP screenshot (Playwright MCP) | Graceful per-widget empty states |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Consistent with T003 shell + T007 widget styling |
| Typography matches spec | Computed style | Consistent with shell |
| Spacing / layout matches spec | Computed style | Grid gaps consistent, widgets don't overlap |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Widgets stack single-column, no overflow |
| Tablet (768px) | MCP screenshot (Playwright MCP) | 2-column widget grid |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Full 4-widget grid |

---

## Approach

Dashboard page under `/apps/web/src/pages/Dashboard`, fetching in parallel from T007/T008/T012/T013's existing endpoints (TanStack Query, parallel queries not waterfalled — critical for the 1.5s p95 target). Role check determines whether the Tasks widget queries "my tasks" vs "all Kitchen tasks."

---

## Edge Case Checklist

- [ ] A Kitchen with zero Tasks/Announcements/Notes yet shows a clean empty-state per widget, not a broken/blank layout
- [ ] Parallel widget fetches don't waterfall (verify via network tab / timing, not just code review)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/web/src/pages/Dashboard/**` | Dashboard page composing all 4 widgets |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/**` | This is a pure composition task — no new backend endpoints |

---

## Test Plan

E2E tests for Staff vs Chef view, empty state, and a performance measurement pass (documented methodology + pasted numbers, not just "felt fast").

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
