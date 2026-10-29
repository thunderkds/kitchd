# TASK_GUIDE — M002: Retro code + security review of the React Native migration
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: High
**Priority**: P0
**Assigned agent**: Supervisor (independent reviewer agents) → mobile-developer for fixes
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-96

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md`
2. Read `memory/MEMORY.md` (mobile + auth entries)
3. Read this file completely

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> `5904b08` (Expo app + shared session core, ~1,000 lines of non-lockfile source) landed with no TASK_GUIDE, no review and no tests. Review it — plus its follow-ups `80a0bcf` and `f95e26a` — with the auth/session boundary as the focus, and fix every P0/P1 finding before the mobile scope builds anything on top.

**Review scope** (`git diff 58e5179..f95e26a`, excluding `pnpm-lock.yaml` and the two planning docs):
- `apps/mobile/src/{api,apiBase,session,storage}.ts`, `apps/mobile/app/**` (13 screens)
- `packages/shared/src/{session,auth.dto,index}.ts`
- `apps/web/src/routes/auth.ts`, `apps/web/src/routes/pages/LoginPage.tsx`, `apps/web/src/features/team/api.ts` (web repointed at the shared session store)

**Focus questions** (must each get an explicit answer in the review):
1. Token storage: is the access token only in `expo-secure-store` (never AsyncStorage/plain storage), and is the in-memory cache cleared on logout?
2. `sessionReady` hydration race: can any screen read `getToken()`/`getUser()` or fire an authenticated request before hydration completes on cold start, and redirect to login (or worse, act as a stale user)?
3. Legacy migration (`f95e26a`): does migrating legacy storage ever leave a token in insecure storage, or resurrect a logged-out session?
4. `apiBase.ts`: is a production build able to point at a non-HTTPS / dev host by accident?
5. Web regression: does the shared session store change web logout/login semantics vs. the pre-`5904b08` `routes/auth.ts`?

**Out of scope**: TanStack Query adoption (M004), forms (M005), new screens.

---

## Dependencies & Reachability

**Depends on**: M003 (tests to pin fixes) — fixes are test-first using M003's runner
**Entry point**: `apps/mobile/app/_layout.tsx` (session hydration) — review artefact for the rest
**Consumer**: every authenticated mobile screen; web login/logout

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Code review (`code-review` skill personas) and security review run over the scope; findings recorded with severity + confidence in `tasks/TASK_REVIEW_M002.md` | "review it" |
| 2 | Each of the 5 focus questions has an explicit yes/no answer with `path:line` evidence | "auth/session boundary as the focus" |
| 3 | Every P0/P1 finding is fixed test-first (failing test in the M003 runner first), or explicitly deferred by a new KANBAN row with a reason | "fix every P0/P1" |
| 4 | P2/P3 findings are listed as follow-up rows (not fixed here) | Simplicity First |
| 5 | Mobile tests, mobile typecheck, web vitest and web build all pass after fixes | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/web exec vitest run && pnpm --filter @kitchenos/web run build
```

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M002.md`.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/session.ts`, `storage.ts`, `apps/mobile/app/_layout.tsx` | only if P0/P1 found |
| `apps/mobile/src/*.test.ts` | regression tests for fixes |
| `tasks/TASK_REVIEW_M002.md` | review record |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | backend auth is out of scope (reviewed in T001/T002) |

---

## Completion Checklist

- [ ] Reviews run, findings recorded
- [ ] 5 focus questions answered
- [ ] P0/P1 fixed test-first or deferred with a row
- [ ] Verification command passes
