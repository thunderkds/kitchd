# TASK_GUIDE — M014: Shift Log screen
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-109

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/features/shift-logs/ShiftLogsPage.tsx`, `shift-logs/api.ts`, `shift-logs/types.ts` (incl. T044 review fixes: in-dialog form error, `canWrite` allow-list)
4. Read the API controller/DTO for every route you call: `apps/api/src/shift-logs/shift-logs.controller.ts`, `dto/create-shift-log.dto.ts`
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> A Shift Log screen on mobile lists the kitchen's shift logs and lets non-Viewer roles add one — parity with web T044.

**Out of scope**: edit/delete (API has none).

---

## Dependencies & Reachability

**Depends on**: M004
**Entry point**: dashboard link → `app/shift-logs.tsx`
**Consumer**: all roles read; OACS write

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `app/shift-logs.tsx` lists logs from `GET /shift-logs` (newest first, as web) with loading/error/empty states | M014 |
| 2 | Composer (hidden for VIEWER, allow-list as web `canWrite`) posts via `POST /shift-logs` with the DTO shape, then refreshes; empty body blocked; API error shown next to the form | M014 |
| 3 | Dashboard links to the screen | M014 |
| 4 | Tests: list/empty, viewer has no composer, post + invalidation, error display | test-first |
| 5 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m014-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M014.md`.

---

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**`, `apps/web/**`, `packages/shared/**` | out of scope — mobile consumer only; if the API is missing something, STOP and report |

---

## Completion Checklist

- [ ] Tests first (paste failing output)
- [ ] Verification command passes (`exit=0`, typecheck, export)
- [ ] Supervisor notified: ready for Stage 4
