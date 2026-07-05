# TASK_GUIDE — T016: Notification center (bell icon, unread count, mark-as-read)
**Date**: 2026-07-02
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C1 task — codebase-map read not required

---

## Requirement (Pillar 1 — Adapt the requirement)

Aggregate mentions, low-stock alerts, and task assignments into one in-app notification feed.

**Restated intent**:
> A bell icon shows unread count and a feed of notifications triggered by @mentions (T015), low-stock threshold crossings (T007), and Task assignment; opening it marks visible notifications read.

**Out of scope**:
- Email/push notifications (explicitly deferred to Post-MVP per PRD Open Questions #4)
- Realtime push delivery (T017 — this task builds the data model and poll/fetch UI; T017 adds live push on top)

**Requirement Refs**:
- FR-014 (mention notify)
- US-006 (low-stock notify), US-008

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A Notification is created when the current user is @mentioned | FR-014 |
| 2 | Opening the bell marks all visible notifications read and decrements unread count | US-008 |
| 3 | A low-stock alert produces exactly one Notification per Ingredient crossing threshold (no duplicate spam) | US-006 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | User A mentions User B in a Comment | Notification row created for User B | automated test |
| 2 | User B opens the bell | Notifications marked read, unread count → 0 | automated test |
| 3 | Ingredient crosses below threshold twice in quick succession (in/out/in) | Only one Notification per distinct crossing event, no spam | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- notifications && npm --prefix apps/web run test -- notifications
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/api/src/notifications/notifications.e2e.spec.ts` (AC1 "creates a Notification when the current user is @mentioned", AC2 "mark-read clears unread notifications and decrements the count", AC3 "low-stock crossing notifies once, not on every poll"); `apps/web/src/components/NotificationBell/NotificationBell.test.tsx` (badge render, dropdown open, AC2 mark-read clears badge) |
| Verification command run | pass | Guide's literal command `npm --prefix apps/api run test -- notifications && npm --prefix apps/web run test -- notifications` — API half passes (4/4, see below); web half returns "No test files found" because the vitest substring filter needs the exact component-folder name (`NotificationBell`, no trailing `s`), not `notifications` — a stale-command gotcha per `memory/learnings.md`. Working equivalent: `npm --prefix apps/api run test -- notifications && npm --prefix apps/web run test -- Notification` — both pass (see full output below). |
| Negative cases hold | pass | "does not create a Notification when no mention resolves" (api e2e) and "shows an error message if the fetch fails" (web) both pass |
| verify | pass | PASS — API: `POST /auth/signup` then `GET /notifications` → `{"notifications":[],"unreadCount":0}`, `POST /notifications/mark-read` → `{"unreadCount":0}` (live curl against `npm run start:dev` on :3000). Web: `npm run dev -- --port 5183` served 200 OK with NotificationBell mounted in Topbar. Full component-level behavior (badge, dropdown, mark-read) covered by the 6 NotificationBell.test.tsx cases (all passing). No browser/MCP screenshot tool was available in this agent's toolset — recommend Supervisor Stage 5 `verify` run a live browser check if a visual screenshot is required beyond DOM assertions. |
| Review scope bounded to blast radius | pass | Touched: new `notifications` module; one additive hook line in `comments.service.ts#create`; `alerts.service.ts` low-stock diff/notify + `Ingredient.wasLowStock` migration; `Topbar.tsx` one-line mount. No unrelated files touched. |
| Full smoke suite still green | pass | `npm --prefix apps/api run test`: 19 suites / 146 tests passed. `npm --prefix apps/web run test`: 9 files / 43 tests passed (full output below). |
| **UI: Visual regression** | ☐ N/A | No MCP/Playwright browser tool available to this agent — component behavior (badge count, dropdown list, empty/error states) is covered by RTL assertions in `NotificationBell.test.tsx` instead. Flagging for Supervisor Stage 5 `verify` with actual screenshot tooling. |
| **UI: Design-system compliance** | pass | Bell/dropdown reuse the existing Tailwind utility classes from `Comments.tsx`/`Topbar.tsx` (border, rounded, text-gray-* scale); unread badge uses `bg-red-600`/`text-white` (existing alert-color convention, matches `Comments.tsx` error text `text-red-700` family) |
| **UI: Responsiveness** | ☐ N/A | No MCP/Playwright browser tool available to this agent to capture per-viewport screenshots. Dropdown uses `max-w-[calc(100vw-2rem)]` to avoid horizontal overflow on narrow viewports (code-level mitigation only, not visually verified). Flagging for Supervisor Stage 5 `verify`. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| NotificationBell + dropdown feed | MCP screenshot (Playwright MCP) | Unread badge count, list of recent notifications |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Unread badge uses accent/alert color |
| Typography matches spec | Computed style | Consistent with shell |
| Spacing / layout matches spec | Computed style | Dropdown doesn't overflow viewport |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Dropdown becomes full-width sheet, not clipped |
| Tablet (768px) | MCP screenshot (Playwright MCP) | Dropdown anchored to bell |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Dropdown anchored to bell |

---

## Approach

Notification module under `/apps/api/src/notifications`, consuming events from T015 (mentions) and T007's alert data (low-stock). Deduplicate low-stock notifications by tracking the last-known crossing state per Ingredient — only notify on a state transition (above→below threshold), not on every poll. Frontend bell polls or fetches on mount for MVP; T017 later adds live push.

**Scope clarification (2026-07-05, Supervisor)**: unlike T007/T012-T015, this task is NOT a standalone module — it requires a small, surgical hook into `CommentsService#create` (T015) to emit a Notification row when a mention resolves, and new state (e.g. a `lastKnownLowStock: boolean` column on Ingredient, or a small tracking table) to detect the above→below transition for AC3's dedup requirement, since T007's alert endpoint is a stateless query with nothing to diff against. This is in scope — "Files Must NOT Touch" only excludes `/apps/api/src/realtime` (T017's scope), not Comments/Inventory. Keep the touch to Comments minimal (one hook call, not a rewrite) and prefer the simplest schema addition for the crossing-state (a single boolean column is likely simpler than a new table). Task-assignment notifications are mentioned in the Restated Intent but have no Acceptance Criterion — implement only if trivial alongside the two ACs that ARE tested (mention, low-stock dedup); do not let it expand scope.

---

## Edge Case Checklist

- [x] Rapid repeated stock crossing the threshold does not spam duplicate notifications — only transition events notify (`Ingredient.wasLowStock` transition guard; covered by AC3 test)
- [x] Notification referencing a since-deleted Task/Comment displays gracefully (not a broken link) — `Notification` has no FK to Comment/Ingredient/Task, body is a fully-rendered snapshot string at creation time, so nothing is re-derived from a possibly-deleted source at read time

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/notifications/**` | Notification module |
| `/apps/web/src/components/NotificationBell/**` | Bell + dropdown component |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/realtime` | T017's scope — push delivery, not this task |

---

## Test Plan

Automated tests for notification creation triggers, dedup/transition logic, mark-as-read.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run (Supervisor/Stage 4)
- [x] Security review: N/A (Low risk)
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run (manual curl/dev-server pass; no browser/MCP tool available to this agent — see verify row)
- [ ] `memory/MEMORY.md` updated (Supervisor-owned)
- [x] Supervisor notified: task ready for Stage 4 review
