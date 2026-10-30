# TASK_GUIDE — M021: M013 follow-ups: login landing mid-logout must keep its saved session; trim BEFORE capture
**Date**: 2026-10-30
**Complexity Level**: C1
**Risk Level**: Medium
**Priority**: P3
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Parallel wave**: M018 / M019 / M020 / M021 run concurrently in separate worktrees — stay inside your file list.

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> If a login (persistSession) completes while clearSession is still awaiting its SecureStore deletes, the new login's saved session is not deleted; `tasks/M013_BEFORE.txt` is reduced to the useful lines.

Restated intent confirmed: Supervisor (user asked to start all pending work in parallel, 2026-10-30).

**Brainstorming (Lightweight tier)**: one recommended path — in `clearSession`, capture `nativeWriteVersion` after the in-memory clear; after the awaits, delete/overwrite `session` only if the version is unchanged (otherwise a newer write owns the blob). Alternatives rejected: a write queue (F8, cut in M013 — Simplicity First); a mutex around persist/clear (more code, same effect). Edge cases: version unchanged → M013 behaviour exactly; version changed → no delete, no empty overwrite, legacy deletes still done; hydration guard unaffected.

---

## Dependencies & Reachability

**Depends on**: M013
**Entry point**: `apps/mobile/src/storage.ts` `clearSession` (sign-out button, 401 path)
**Consumer**: every mobile user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Test: start `clearSession()`, hold the legacy deletes, run `persistSession('new-token', user)`, release → stored `session` blob holds `new-token` and the next hydration restores it | race |
| 2 | All M013 logout-durability tests (`storage.test.ts` › logout durability) still pass unchanged | no regression |
| 3 | `tasks/M013_BEFORE.txt` trimmed to: the `date -u` line, the list of failing test names, and the `Tests:` summary line (≤ 40 lines) | M013 P3 |
| 4 | mobile test + typecheck pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M021.md`.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/storage.ts` | AC1 |
| `apps/mobile/src/storage.test.ts` | AC1 |
| `tasks/M013_BEFORE.txt` | AC3 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/theme.ts` | palette is fixed for this wave |
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |
| `apps/mobile/src/api.ts` | 401 path out of scope |
| any `apps/mobile/app/**` | other agents own the screens |

