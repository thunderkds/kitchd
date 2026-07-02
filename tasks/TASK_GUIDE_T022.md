# TASK_GUIDE — T022: QA pass + seed demo data + onboarding walkthrough
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P0
**Assigned agent**: qa-expert
**Agent guide**: `.claude/agents/qa.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/qa.md`
5. C2 task — read `memory/codebase-map.md` if present

Note: "QA suite" scope triggers the CLAUDE.md Hard-Stop Gate 2 complexity floor (C2/Medium minimum) explicitly.

---

## Requirement (Pillar 1 — Adapt the requirement)

The final MVP Definition-of-Done gate — independently verify every PRD acceptance criterion works end-to-end, together, not just per-task.

**Restated intent**:
> A seed script produces realistic demo data; every one of the PRD's 8 MVP acceptance-criteria bullets is exercised end-to-end with pasted evidence; the full smoke suite (all T001–T021 tests) passes together as one integrated run, not just individually.

**Out of scope**:
- Fixing any newly-discovered bug directly — file it back to the Supervisor for a targeted fix task (via `bugfix` skill) rather than patching ad-hoc during QA

**Requirement Refs**:
- All FRs/NFRs; PRD "Acceptance Criteria (MVP definition of done)" section

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Seed script runs cleanly on a fresh DB | Foundation for all manual QA below |
| 2 | Each of the 8 PRD MVP acceptance-criteria bullets has a pasted pass/fail result in this task's Evidence table | PRD §"Acceptance Criteria" |
| 3 | Full smoke suite (T001–T021 tests run together) passes | Integration-level regression check |
| 4 | Onboarding walkthrough doc exists and a fresh reader can follow it to a working first session | Founder self-testing usability |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Fresh DB, run seed script | 1 Org, 1 Kitchen, multiple Users across roles, sample Recipes/Ingredients/Tasks/Notes created | automated + manual DB check |
| 2 | Seed script run twice | Idempotent — no duplicate/error on second run | automated test |
| 3 | Full test suite across all apps | All green in one combined run | CI-style combined run, output pasted |
| 4 | Walk each of PRD's 8 MVP acceptance-criteria bullets manually | Each produces a pass/fail with evidence (screenshot or output) | manual, pasted in Evidence table below |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test && npm --prefix apps/web run test && npm --prefix apps/api run seed
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | N/A — this task's scope IS the full app |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — covered per-task in T003–T021 | |
| UI: Design-system compliance | ☐ N/A — covered per-task | |
| UI: Responsiveness | ☐ N/A — covered in T021 | |

### PRD MVP Acceptance Criteria — Independent Verification (fill during this task)

| # | PRD Criterion | Result | Evidence |
|---|---------------|--------|----------|
| 1 | Chef creates a recipe with ingredients & steps; system computes estimated cost | ☐ pass / ☐ fail | |
| 2 | Chef creates a daily prep task list, assigns to staff, staff checks items off on a tablet | ☐ pass / ☐ fail | |
| 3 | Ingredient stock decreases automatically/one-tap-confirm when a recipe-based task completes | ☐ pass / ☐ fail | |
| 4 | System flags any ingredient below min-threshold on the dashboard | ☐ pass / ☐ fail | |
| 5 | Team member posts a shift note visible next shift; comment @mention notifies mentioned user | ☐ pass / ☐ fail | |
| 6 | Notes created standalone or linked to recipe/task, tagged, searched | ☐ pass / ☐ fail | |
| 7 | Roles restrict edit-guidelines/inventory vs view-only/complete-tasks | ☐ pass / ☐ fail | |
| 8 | Whole flow works on phone/tablet without horizontal scrolling | ☐ pass / ☐ fail | |

---

## Approach

QA-Automation-Agent independently exercises each PRD acceptance criterion — must NOT be the sole author of its own acceptance test per the general rule (the Supervisor already wrote/confirmed the 8-bullet oracle above at PRD generation time, satisfying that constraint). Seed script populates Organization "Demo Kitchen Co", one Kitchen, 4 Users (one per role), 3–5 sample Recipes with realistic ingredients, a handful of Tasks in varying states, a couple of Notes and Announcements.

---

## Edge Case Checklist

- [ ] Seed script run twice is idempotent (no duplicate/error)
- [ ] A regression only surfaces when combined with a later task (integration-level bug) — specifically re-test T011's stock deduction against T019's RBAC changes together

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/prisma/seed.ts` (or equivalent) | Demo data seed script |
| `docs/onboarding.md` | Onboarding walkthrough |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Any application source file | QA/verification task — bugs found are filed back to the Supervisor for a dedicated fix task, not patched here |

---

## Test Plan

Combined full-suite run across `/apps/api` and `/apps/web`; manual walkthrough of all 8 PRD acceptance criteria with evidence pasted per row above.

---

## Completion Checklist

- [ ] Implementation done (seed script + onboarding doc)
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A unless a security-relevant regression is found during QA (Medium risk, judgment call)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated (any final learnings from the full-system pass)
- [ ] Supervisor notified: MVP milestone ready for Stage 5 integration
