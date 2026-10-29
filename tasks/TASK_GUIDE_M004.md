# TASK_GUIDE — M004: Adopt TanStack Query on mobile (incremental, over `api.ts`)
**Date**: 2026-10-29
**Complexity Level**: C3
**Risk Level**: Medium
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-98

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md`
2. Read `docs/ddr/0001-mobile-server-state-tanstack-query-incremental.md` — **the decision this task implements**
3. Read `tasks/TASK_REVIEW_M002.md` (session boundary findings) and this file

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> Per DDR-0001: add TanStack Query to `apps/mobile`, wire it to app foreground, and move the list screens' reads and writes onto `useQuery`/`useMutation` while keeping `apps/mobile/src/api.ts` as the unchanged fetch layer.

**Out of scope**: rewriting `api.ts`; web; forms/validation (M005); realtime (M009); FlashList (M010); task detail screen beyond what's needed to keep it compiling.

---

## Dependencies & Reachability

**Depends on**: M003 (runner), M012 (session hardening — 401 clears session; queries must not retry a 401)
**Entry point**: `apps/mobile/app/_layout.tsx` (`QueryClientProvider` inside the `sessionReady` gate)
**Consumer**: `app/{tasks,recipes,guidelines,announcements,notes,inventory,team,invites}.tsx`

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `@tanstack/react-query` (v5) added; one `QueryClient` created in `src/queryClient.ts`; provider mounted in `_layout.tsx` only after `sessionReady` | DDR decision |
| 2 | `focusManager` is wired to `AppState` (`active` → focused) in `src/queryClient.ts` | foreground refetch |
| 3 | Retry policy: never retry on 401/403/404 (errors from `request()` must carry the status — add a `status` field to the thrown error if absent, without changing messages); otherwise ≤1 retry | session boundary |
| 4 | `src/queryKeys.ts` defines keys for every migrated resource | consistency |
| 5 | The 8 list screens read via `useQuery` and write via `useMutation` + `invalidateQueries`; loading/error/empty UI unchanged in wording | migration |
| 6 | Logout (`clearSession`) also calls `queryClient.clear()` so user A's cached data can't render for user B | security |
| 7 | Tests: retry policy (401 not retried, 500 retried once), `focusManager` wiring, logout clears the cache, and at least one screen-level hook test (e.g. a `useTasks` hook with a mocked `api.ts`) | test-first |
| 8 | `pnpm --filter @kitchenos/mobile test` and `typecheck` pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```

Device verification is **not available in this environment** (no simulator); Stage 5 relies on tests + typecheck + an `expo export --platform ios` bundle smoke (`pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m004-export`) to prove the bundle builds.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M004.md`.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/mobile/package.json`, `pnpm-lock.yaml` | dependency |
| `apps/mobile/src/queryClient.ts`, `src/queryKeys.ts` | new |
| `apps/mobile/src/api.ts` | only: attach `status` to thrown errors |
| `apps/mobile/src/storage.ts` or sign-out path | `queryClient.clear()` on logout |
| `apps/mobile/app/_layout.tsx` + 8 list screens | migration |
| `apps/mobile/src/*.test.ts(x)` | tests |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |

---

## Completion Checklist

- [ ] Tests first (paste failing output)
- [ ] Verification command + export smoke pass
- [ ] Supervisor notified: ready for Stage 4
