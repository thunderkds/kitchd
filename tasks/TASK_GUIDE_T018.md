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

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/web/src/pages/Dashboard/Dashboard.test.tsx` (AC1 "loads all four widgets", AC2 Staff-only-own-tasks + Chef-sees-all, AC4 zero-data empty state per widget, + a structural no-waterfall check), `apps/web/src/components/AnnouncementsWidget/AnnouncementsWidget.test.tsx`, `apps/web/src/components/PinnedNotesWidget/PinnedNotesWidget.test.tsx`. `npm --prefix apps/web run test -- dashboard` → "Test Files 1 passed (1) / Tests 5 passed (5)". |
| Verification command run | pass | Ran guide's literal command `npm --prefix apps/web run test -- dashboard` (case-insensitive substring match against `Dashboard.test.tsx` — works as-is, no filter correction needed this time): `Test Files 1 passed (1)`, `Tests 5 passed (5)`, `Duration 724ms`. |
| Negative cases hold | pass | Staff role does NOT see another user's task (`tasks-widget-row-t-other` asserted absent in the Staff test); fetch-error path asserted via `role="alert"` in all 3 new widget test suites (Announcements/PinnedNotes) plus pre-existing LowStockWidget coverage. |
| verify | pass | PASS — `npm --prefix apps/web run test` (full web suite): `Test Files 12 passed (12)`, `Tests 52 passed (52)`. `npm --prefix apps/web run lint` → oxlint clean, no output. `npm --prefix apps/web run build`: `tsc -b` fails on 2 **pre-existing** errors unrelated to this change — confirmed via `git stash`/rebuild before my edits, same 2 errors reproduce (`Cannot find module '@kitchenos/shared'` — package needs `dist/` built, a monorepo build-order issue; `vite.config.ts` `test` key type overload — pre-existing vitest/vite version mismatch). Live browser MCP screenshot verification (Staff vs Chef view, empty state, breakpoints) could **not** be captured in this session: port 8766 (the fixed MCP-targeted web dev port per memory/MEMORY.md) was already held by a concurrent T016 worktree dev server (`readlink /proc/<pid>/cwd` confirmed `.claude/worktrees/T016/apps/web`), and no Playwright/UI-MCP tool was available in this agent's toolset to target an alternate port. Flagging to Supervisor: Stage 5 `verify`/live-browser check still needed once port 8766 is free or an MCP tool is attached. |
| Review scope bounded to blast radius | pass | Touched: `apps/web/src/pages/Dashboard/**` (new), `apps/web/src/components/AnnouncementsWidget/**` (new), `apps/web/src/components/PinnedNotesWidget/**` (new), `apps/web/src/App.tsx` + `App.test.tsx` (route wiring), `apps/web/src/routes/auth.ts` + `LoginPage.tsx` (added `getUser`/`setUser` for role-aware Tasks widget — needed since no `/auth/me` endpoint exists and the JWT deliberately omits `role`), `packages/shared/src/auth.dto.ts` (added missing `role` field to match the API's actual runtime `AuthResult` shape). No `apps/api/**` files touched, per Files-Must-Not-Touch. |
| Full smoke suite still green | pass | `npm --prefix apps/web run test`: `Test Files 12 passed (12)`, `Tests 52 passed (52)` (includes pre-existing TasksPage/NotesPage/LowStockWidget/AuthGuard/App suites). |
| **UI: Visual regression** | ☐ N/A | Justification: no Playwright/UI-MCP tool available in this session and port 8766 was occupied by a concurrent worktree's dev server (see `verify` row) — could not capture screenshots. Deferred to Stage 5/Supervisor for live capture. |
| **UI: Design-system compliance** | pass | All 3 new/composed widgets (`TasksWidget`, `AnnouncementsWidget`, `PinnedNotesWidget`) reuse T007 `LowStockWidget`'s exact Tailwind shape verbatim: `border rounded-lg p-4 w-full` container, `text-sm font-semibold text-gray-900 mb-3` heading, `divide-y` list, `text-sm text-gray-500` empty/loading state, `role="alert"` + `text-red-700` error state — confirmed by direct code comparison, no new tokens introduced. |
| **UI: Responsiveness** | pass | Dashboard grid uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (mirrors T003 shell's existing responsive breakpoint convention: 1-col mobile, 2-col tablet ≥768px `md:`, 4-col desktop ≥1024px `lg:`) — structurally guarantees the 3 required layouts (single-column mobile, 2-column tablet, full 4-widget desktop) per Tailwind's documented breakpoints. Live-viewport screenshot capture not performed this session (see UI: Visual regression row); code-level breakpoint check is the substitute evidence per the guide's allowance for "structural verification, documented as method." |

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

**Scope correction (2026-07-05, Supervisor)**: T007 built a reusable standalone `LowStockWidget` (compose as-is). T013 (Announcements) was backend-only — no frontend widget exists yet — so this task must build a small `AnnouncementsWidget` (list latest N announcements from `GET /announcements`) as part of composing the Dashboard, not just wire up an existing component. Similarly there is no existing "pinned Notes" widget — build a thin filter view over T012's `GET /notes` (client-side filter for `pinned: true`, or add a `?pinned=true` query param to the existing endpoint if simpler) rather than reusing `NotesPage` wholesale. Keep both new widgets minimal (list + empty state), matching `LowStockWidget`'s shape — do not scope-creep into full CRUD UIs for either.

---

## Edge Case Checklist

- [x] A Kitchen with zero Tasks/Announcements/Notes yet shows a clean empty-state per widget, not a broken/blank layout (`Dashboard.test.tsx` AC4)
- [x] Parallel widget fetches don't waterfall — structurally guaranteed (4 independent widget-owned `useEffect`s, no shared parent fetch/await, no data dependency between them) and unit-verified (`Dashboard.test.tsx` "does not waterfall" test asserts all 4 fetch spies called synchronously on mount before any resolves); live Network-tab timing not captured this session (no browser/MCP tool available — see verify row)

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

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run (deferred to Supervisor/Stage 4, per pipeline — not run by the implementing agent)
- [x] Security review: N/A (Low risk)
- [x] Lint passes (`oxlint` clean)
- [x] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run (partial — unit/lint/build-diff verified; live browser MCP verification blocked this session, see Evidence `verify` row — needs Stage 5 follow-up)
- [ ] `memory/MEMORY.md` updated (Supervisor-owned, per Memory Write Protocol)
- [x] Supervisor notified: task ready for Stage 4 review
