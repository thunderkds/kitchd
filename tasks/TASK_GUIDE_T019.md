# TASK_GUIDE — T019: RBAC enforcement audit across all CRUD
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: High
**Priority**: P0
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C2 task — read `memory/codebase-map.md` if present

Note: per CLAUDE.md Hard-Stop Gate 2, any task whose scope resembles "test coverage" / structural verification starts at a C2/Medium floor at minimum — this task is already C2/High given its security-sensitivity, so the floor is exceeded, not just met.

---

## Requirement (Pillar 1 — Adapt the requirement)

Close the loop on RBAC: verify every module built in T004–T015 actually enforces roles correctly, including the previously-unexercised Viewer role.

**Restated intent**:
> Every CRUD endpoint across Inventory, Recipes, Guidelines, Tasks is verified against the 4-role matrix (Owner/Admin, Chef, Staff, Viewer), with automated tests proving each cell, and zero ad-hoc permission checks outside `RolesGuard`.

**Scope correction (2026-07-05, Supervisor)**: The original scope listed 8 modules including Notes, Announcements, ShiftLogs, Comments — those are T012–T015, still Todo, and don't exist in the codebase yet. Same task-numbering-isn't-a-dependency-graph gap previously hit on T009/T006 (see `memory/learnings.md`). Per user decision, this pass covers only the 4 modules that exist today (Inventory, Recipes, Guidelines, Tasks). A follow-up RBAC audit pass covering Notes/Announcements/ShiftLog/Comments is required once T012–T015 land — track as a new task at that time, do not silently consider T019 fully closing FR-018 forever.

**Out of scope**:
- Building any new feature — this is a verification-and-fix pass on existing modules only
- Notes/Announcements/ShiftLogs/Comments RBAC (modules don't exist yet — T012-T015)

**Requirement Refs**:
- FR-018, US-010

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A written audit matrix (endpoint × role × expected access) exists for every entity module | FR-018 |
| 2 | A passing automated test asserts each matrix cell | FR-018, US-010 |
| 3 | Zero endpoints found using inline permission checks instead of `RolesGuard` (grep-verified) | FR-018 |
| 4 | Viewer role is confirmed read-only on every module | FR-018 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Viewer JWT calls a write endpoint on any of the 8 modules | 403 on all of them | automated test suite, one per module |
| 2 | `grep -rn "req.user.role ===" apps/api/src` (or equivalent pattern) | No matches outside `roles.guard.ts` | manual grep, pasted in evidence |
| 3 | Audit matrix reviewed against `PRD.md` FR-018's role list | Matches exactly (Owner/Admin, Chef, Staff, Viewer) | manual review |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- rbac-audit
```

### Grep evidence (AC3 — zero permission checks bypassing RolesGuard)

```
$ grep -rn "req\.user\.role\s*===" apps/api/src
auth/guards/roles.guard.ts:17: * never an inline `req.user.role === ...` check.
```
Only match is the doc-comment inside `roles.guard.ts` itself describing the anti-pattern — zero actual inline `req.user.role === ...` checks anywhere in the codebase.

```
$ grep -rln "caller\.role\|isWriter\|WRITE_ROLES\.includes" --include="*.ts" apps/api/src | grep -v "\.spec\.ts"
tasks/complete/task-completion.controller.ts   (only passes caller.role through, no comparison)
tasks/tasks.service.ts                          (isWriter = WRITE_ROLES.includes(caller.role))
tasks/tasks.controller.ts                        (only passes caller.role through, no comparison)
tasks/complete/task-completion.service.ts        (isWriter = WRITE_ROLES.includes(caller.role))
```
The two `.service.ts` hits are documented, intentional finer-grained **ownership** checks ("is this Task assigned to me?") that `RolesGuard`'s coarse allow/deny model cannot express — both `TasksController` and `TaskCompletionController` still apply `@UseGuards(JwtAuthGuard, RolesGuard)` for the coarse role gate; these checks run in addition to, not instead of, `RolesGuard`. This is the same pattern already documented in `PROJECT_SPEC.md`'s T008 decision log entry.

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/api/src/rbac-audit/rbac-matrix.e2e.spec.ts` — 16 tests, one matrix suite per in-scope module (Inventory, Recipes, Guidelines, Tasks incl. T011 completion sub-resource) × 4 roles (Owner/Chef=WRITE, Staff, Viewer) × CRUD verb, plus 3 cross-Kitchen-leak edge cases and 1 unauthenticated-401 sweep. Output: `Test Suites: 1 passed, 1 total / Tests: 16 passed, 16 total` (see full log below). |
| Verification command run | ☑ pass | `npm --prefix apps/api run test -- rbac-audit` (with `DATABASE_URL`/`JWT_SECRET`/`JWT_EXPIRES_IN` exported per `.env.example`) → `PASS src/rbac-audit/rbac-matrix.e2e.spec.ts (9.14 s)` / `Tests: 16 passed, 16 total`. |
| Negative cases hold | ☑ pass | Staff/Viewer get 403 on every write verb across all 4 modules; unauthenticated gets 401 (not 403) on every module; cross-kitchen list calls return `[]` (not leaked rows), not 403/404 (list endpoints correctly scope by kitchenId rather than erroring). |
| verify | ☑ pass | Full `npm run test` suite (all 13 suites incl. pre-existing T004-T011 specs) still green after the RBAC fix: `Test Suites: 13 passed, 13 total / Tests: 99 passed, 99 total`. No regressions from the two surgical RBAC fixes. Supervisor-driven independent live-API session (not just the automated suite): signup owner → invite+accept Viewer → create Task → assign to Viewer → Viewer `PATCH /tasks/:id {status}` → 403 "Viewer role is read-only"; Viewer `GET /tasks/:id` → 200 (read still allowed); Viewer `POST /tasks/:id/complete/preview` → 403 same message. Archived to `reports/evidence/T019/verify-api-session.txt`. |
| Review scope bounded to blast radius | ☑ pass | Touched only `apps/api/src/tasks/tasks.service.ts` and `apps/api/src/tasks/complete/task-completion.service.ts` (the two files with the actual RBAC gap) plus the new test file `apps/api/src/rbac-audit/rbac-matrix.e2e.spec.ts`. No controller/DTO/schema changes. |
| Full smoke suite still green | ☑ pass | `npm run test` (full apps/api suite): `Test Suites: 13 passed, 13 total / Tests: 99 passed, 99 total`. `npm run lint`: clean, no errors/warnings. |
| UI: Visual regression | ☑ N/A — backend audit task, no UI touched | |
| UI: Design-system compliance | ☑ N/A | |
| UI: Responsiveness | ☑ N/A | |

---

## Approach

Build a matrix test file iterating every (module, role) pair against every CRUD verb, asserting expected 200/403. Grep the codebase for any permission check not going through `RolesGuard`/`@Roles()`. Fix any gap found in the underlying module directly (this task can touch T004–T015's files to fix RBAC gaps, but must not add new features while doing so — surgical fixes only).

---

## Edge Case Checklist

- [x] A route that's technically read-only but wasn't obviously "permission-sensitive" (e.g. a search endpoint) is checked for cross-Kitchen data leakage, not just role gating — verified `GET /ingredients`, `GET /recipes`, `GET /guidelines?type=`, `GET /tasks` all return `[]` (never another Kitchen's rows) for a fresh Kitchen B owner
- [x] Viewer role, never explicitly exercised in T004–T011's per-task tests, is now covered everywhere — exercised on every read AND write verb across all 4 modules, plus the T011 completion sub-resource, in `rbac-matrix.e2e.spec.ts`

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/**/*.controller.ts` | Audit + surgical RBAC fixes only |
| `/apps/api/test/rbac/**` | New matrix test suite |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Any file outside RBAC-check logic | This task fixes permission gaps only, not features/business logic |

---

## Test Plan

Full matrix test suite (module × role × verb); manual grep verification pasted into evidence.

---

## Completion Checklist

- [x] Implementation done
- [x] Self-review: `Skill({ skill: "code-review" })` run — 0 P0/P1/P2/P3
- [x] Security review: `Skill({ skill: "security-review" })` run (High risk — mandatory) — 0 HIGH/MEDIUM findings
- [x] Lint passes
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run — live API session confirms the Viewer fix (see `verify` row above), evidence archived to `reports/evidence/T019/`
- [ ] `memory/MEMORY.md` updated (any RBAC gaps found + fixed, recorded as a learning) — next: Supervisor diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
