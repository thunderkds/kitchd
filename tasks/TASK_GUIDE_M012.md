# TASK_GUIDE — M012: Mobile session hardening (M002 P2 findings F1–F5)
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Medium (auth/session boundary)
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `tasks/TASK_REVIEW_M002.md` (the findings, with path:line)
3. Read this file completely

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> Fix the five P2 findings from the M002 retro review, each test-first on the M003 jest-expo runner, without changing any behaviour the review did not flag.

| ID | Finding | Required fix |
|----|---------|--------------|
| F1 | `apps/mobile/src/api.ts` `request()`: a 401 never clears the session | on `res.status === 401`: `await clearSession()` then throw (message unchanged) |
| F2 | `apps/mobile/src/apiBase.ts`: silent `http://localhost` / `10.0.2.2` fallback, any `http://` accepted | fallback only when `__DEV__`; outside dev, throw if `EXPO_PUBLIC_API_BASE_URL` is missing or not `https:` |
| F3 | `apps/mobile/app/dashboard.tsx` sign-out: `clearSession()` rejection is unhandled, no navigation | `try { await clearSession() } finally { router.replace('/') }`; log the error with `console.warn` (no token in the log) |
| F4 | `apps/mobile/app/invite/accept.tsx`: effect resets the token field on every keystroke | seed state from the param once; effect depends only on `[initialToken]` (or remove it) |
| F5 | `apps/mobile/expo-env.d.ts`: hand-written ambient `any` stubs override real RN/expo-router/jsx types | delete the stubs (keep the Expo-generated `/// <reference types="expo/types" />`-style content if any is legitimate); fix the type errors that surface surgically. If >~40 errors or any need non-trivial changes, STOP and report the count/categories instead |

**Out of scope**: P3 findings F7–F13 (→ M013), TanStack Query (M004), any API change.

---

## Dependencies & Reachability

**Depends on**: M003 (test runner), M002 (findings)
**Entry point**: `apps/mobile/src/api.ts` `request()`; `apps/mobile/app/dashboard.tsx`; `apps/mobile/app/invite/accept.tsx`; `apps/mobile/src/apiBase.ts`
**Consumer**: every authenticated mobile screen

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Test: `request()` receiving 401 rejects AND the SecureStore mock has no `session` key AND in-memory token is null | F1 |
| 2 | Test: with `__DEV__ = false` and env unset → resolving the API base throws; with `http://x` → throws; with `https://x` → returns it; with `__DEV__ = true` and env unset → dev fallback | F2 |
| 3 | Test (or a small extracted `signOut` helper test): `clearSession` rejecting still navigates to `/` and does not produce an unhandled rejection | F3 |
| 4 | Test: invite-accept with param `token=abc`, typing `x` → input value `abcx` (component test with `@testing-library/react-native` if already available; otherwise extract the state logic into a tiny hook/helper and test that — do not add a heavy dependency without recording why) | F4 |
| 5 | `pnpm --filter @kitchenos/mobile typecheck` passes with `expo-env.d.ts` stubs removed | F5 |
| 6 | All mobile tests, web vitest and web build still pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/web exec vitest run
```

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M012.md`.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/api.ts` | F1 |
| `apps/mobile/src/apiBase.ts` | F2 (export a pure `resolveApiBase(env, isDev, platform)` for testability) |
| `apps/mobile/app/dashboard.tsx` | F3 |
| `apps/mobile/app/invite/accept.tsx` | F4 |
| `apps/mobile/expo-env.d.ts` (+ any files with surfaced type errors) | F5 |
| `apps/mobile/src/*.test.ts(x)` | tests |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**`, `apps/web/**` | out of scope |
| `packages/shared/**` | web consumer; F9 is M013 |

---

## Completion Checklist

- [ ] Each fix preceded by a failing test (paste failures)
- [ ] Verification command passes
- [ ] Supervisor notified: ready for Stage 4
