# TASK_GUIDE — T003: Base layout: sidebar/topbar, empty-state pages
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

Build the app shell every feature screen will live inside.

**Restated intent**:
> A logged-in user sees a sidebar (Dashboard, Tasks, Guidelines, Inventory, Notes, Announcements, Team & Roles, Settings), a top bar, and an empty-state page for each section; an unauthenticated user is redirected to login.

**Out of scope**:
- Any real feature content (Tasks, Recipes, etc. — those are their own tasks)
- Design tokens/branding (not yet defined — this task uses Tailwind defaults)

**Requirement Refs**:
- NFR-005: responsive/mobile-first
- IA from `requirement.md` §8

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with glossary
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | All 8 nav sections render a distinct empty-state page | IA §8 |
| 2 | Unauthenticated user hitting any gated route is redirected to `/login` | NFR-006 (auth from T001) |
| 3 | Layout renders with zero horizontal scroll at 375px width | NFR-005 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged-in user clicks each sidebar item | Each renders its empty-state page | manual + Playwright |
| 2 | Logged-out user navigates to `/tasks` directly | Redirected to `/login` | automated test |
| 3 | Viewport set to 375px | No horizontal scrollbar on any of the 8 pages | manual/screenshot |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/web run test
```
(Original filter `-- layout routing` matched no test filenames — `App.test.tsx`, `AuthGuard.test.tsx`, `LoginPage.test.tsx` — and failed with "No test files found." Corrected to run the full `apps/web` suite, which covers this task's files.)

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/web/src/App.test.tsx` (unauth redirect at `/` and `/tasks`; login form renders; each of 8 nav sections renders its distinct empty state; sidebar lists all 8 items), `apps/web/src/routes/AuthGuard.test.tsx` (redirect when no token; renders protected content when token present), `apps/web/src/routes/pages/LoginPage.test.tsx` (mode toggle) |
| Verification command run | ☑ pass | `npm --prefix apps/web run test` → `Test Files 3 passed (3)`, `Tests 15 passed (15)`, Duration 1.10s |
| Negative cases hold | ☑ pass | Unauthenticated access to `/tasks` and other guarded routes redirects to `/login` (AC2), verified in both automated test and `reports/evidence/T003/redirect-to-login.png` / `hscroll-report.txt` (`redirect-check final-url=http://localhost:8766/login`) |
| `verify` skill — works in running app | ☑ pass | Supervisor-driven live browser session (Stage 5, independent of implementer's own screenshots): signup→dashboard shell render, nav click→route change, logout→redirect, post-logout direct nav to protected route→re-guarded. Evidence: `reports/evidence/T003-verify/` (session HTML/JSON + 2 screenshots) |
| Review scope bounded to blast radius | ☑ pass | Stage 4 code-review scoped to `apps/web/src/layout/**`, `apps/web/src/routes/**`, `App.tsx`/`main.tsx`/`package.json` wiring — matched TASK_GUIDE's predicted file set; `apps/api/**` untouched |
| Full smoke suite still green | ☑ pass | Same run as above — 3/3 suites, 15/15 tests, no failures |
| **UI: Visual regression** | ☑ pass | `reports/evidence/T003/shell-{375,768,1280}.png`, `page-{dashboard,tasks,guidelines,inventory,notes,announcements,team,settings}.png`, `login-desktop.png` — one screenshot per required screen |
| **UI: Design-system compliance** | ☑ pass (interim) | Tailwind default palette/spacing/type scale throughout; no custom design tokens exist yet in this project — accepted as interim per task's out-of-scope note |
| **UI: Responsiveness** | ☑ pass | `reports/evidence/T003/hscroll-report.txt`: `hasHorizontalScroll=false` at 375px, 768px, 1280px across all 8 pages; sidebar collapses to hamburger drawer under `md` (768px) per `shell-375.png` vs `shell-768.png` |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Sidebar + topbar shell | MCP screenshot (Playwright MCP) | Matches IA §8 nav list, no visual regressions between commits |
| Each of 8 empty-state pages | MCP screenshot (Playwright MCP) | Consistent empty-state pattern (icon + message) |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Tailwind default palette (no custom tokens defined yet — flag for future design pass) |
| Typography matches spec | Computed style | Tailwind default type scale |
| Spacing/layout matches spec | Computed style | Consistent Tailwind spacing scale (4/8px grid) |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Sidebar collapses to a drawer/hamburger, no horizontal scroll |
| Tablet (768px) | MCP screenshot (Playwright MCP) | Sidebar visible or collapsible, content readable |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Full sidebar + content layout |

---

## Approach

Standard React Router (or equivalent) route tree with an auth guard wrapping all gated routes, redirecting to `/login` on missing/invalid JWT (checked client-side against T001's auth state; server remains the real authority). Sidebar collapses to a drawer below 768px per NFR-005.

---

## Edge Case Checklist

- [ ] Expired JWT mid-session redirects to login rather than showing a broken page
- [ ] Direct URL navigation to a gated route while logged out redirects correctly (not just nav-link hiding)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/web/src/layout/**` | Sidebar, topbar, shell |
| `/apps/web/src/routes/**` | Route tree, auth guard, empty-state pages |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/**` | Backend, out of scope |

---

## Test Plan

Playwright/RTL tests for route rendering + redirect behavior; manual responsive check at 3 breakpoints.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated (if new patterns)
- [ ] Supervisor notified: task ready for Stage 4 review
