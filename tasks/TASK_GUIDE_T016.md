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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| verify | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| **UI: Visual regression** | ☐ pass / ☐ fail | Bell + dropdown screenshot |
| **UI: Design-system compliance** | ☐ pass / ☐ fail | |
| **UI: Responsiveness** | ☐ pass / ☐ fail | |

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

---

## Edge Case Checklist

- [ ] Rapid repeated stock crossing the threshold does not spam duplicate notifications — only transition events notify
- [ ] Notification referencing a since-deleted Task/Comment displays gracefully (not a broken link)

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

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
