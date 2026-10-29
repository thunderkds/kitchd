# TASK_GUIDE — M015: Dashboard low-stock + expiring-soon widgets
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-110

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/components/LowStockWidget/*`, `apps/web/src/components/ExpiringSoonWidget/*`
4. Read the API controller/DTO for every route you call: `apps/api/src/inventory/alerts/alerts.controller.ts`, `dto/expiring-soon-query.dto.ts`
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> The mobile dashboard shows the low-stock and expiring-soon alert lists, parity with the web widgets.

**Out of scope**: push alerts; changing thresholds (inventory form owns that).

---

## Dependencies & Reachability

**Depends on**: M004
**Entry point**: `apps/mobile/app/dashboard.tsx`
**Consumer**: every signed-in user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Low-stock widget renders items from `GET /inventory/alerts/low-stock` (name, current vs threshold, as web) with empty state | M015 |
| 2 | Expiring-soon widget renders `GET /inventory/alerts/expiring` with the same default window/query as web | M015 |
| 3 | Tapping an item navigates to `/inventory` | M015 |
| 4 | Each widget's error is local to it (one failing doesn't blank the dashboard) | M015 |
| 5 | Tests: both widgets populated/empty/error | test-first |
| 6 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m015-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M015.md`.

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
