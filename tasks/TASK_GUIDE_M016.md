# TASK_GUIDE — M016: Recipe version history
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P2
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-111

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/features/recipes/RecipesPage.tsx` (versions section; T047 fix: refetch deps include `selected?.version`), `recipes/api.ts`
4. Read the API controller/DTO for every route you call: `apps/api/src/recipes/recipes.controller.ts` (`GET /recipes/:id/versions`)
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> On the mobile recipe detail view, users can see the recipe's version history, parity with web T047.

**Out of scope**: diffing or restoring versions (web has neither).

---

## Dependencies & Reachability

**Depends on**: M004
**Entry point**: `apps/mobile/app/recipes.tsx` detail view
**Consumer**: every signed-in user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Recipe detail shows a version list from `GET /recipes/:id/versions` (version number, date, fields web shows) | M016 |
| 2 | After editing a recipe, the versions query is invalidated so the new version appears without re-opening | M016 |
| 3 | Tests: list render, empty state, invalidation after update mutation | test-first |
| 4 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m016-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M016.md`.

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
