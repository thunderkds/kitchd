# TASK_GUIDE — M011: Mobile↔backend coverage audit
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P2 (run early: it scopes M006–M009)
**Assigned agent**: Supervisor (read-only Explore agent does the enumeration)
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-105

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> Produce `docs/audits/backend-mobile-coverage_2026-10-29.md`: every backend route (`@Get/@Post/@Patch/@Put/@Delete` in `apps/api/src/**/*.controller.ts`) matched against non-test sources in `apps/mobile` (`app/**`, `src/**`), the `apps/mobile` equivalent of T042's `docs/audits/backend-frontend-coverage_2026-07-28.md`.

**Out of scope**: building any missing consumer (that is M006–M009 and new rows).

---

## Dependencies & Reachability

**Depends on**: none
**Entry point**: `docs/audits/backend-mobile-coverage_2026-10-29.md`
**Consumer**: M006–M009 scoping; any new rows it registers on `PROJECT_KANBAN_mobile.md`

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | The audit lists every backend route (count stated; T042 found 58 — say if it changed and why) with: consumer file:line in mobile, or "none" | "every backend route" |
| 2 | Each "none" is grouped by product feature and labelled: covered by an existing board row (M006/M007/M008/M009), web-only by design (state why), or **new gap** | scoping |
| 3 | Each new gap becomes a Todo row on `PROJECT_KANBAN_mobile.md` | T042 lesson: gaps must be scheduled |
| 4 | Method section states how matching was done and that every "none" was hand-confirmed against `apps/mobile/app/**` route files | rigour |

---

## Verification Command (exact, runnable)

```bash
grep -rhoE "@(Get|Post|Patch|Put|Delete)\(" apps/api/src --include=*.controller.ts | wc -l
```
(the audit's stated route count must equal this)

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M011.md`.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `docs/audits/backend-mobile-coverage_2026-10-29.md` | new |
| `PROJECT_KANBAN_mobile.md` | new gap rows |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| any source under `apps/` | read-only audit |
