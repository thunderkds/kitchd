# TASK_GUIDE — M013: Mobile P3 debt — logout durability, render-time redirect, login error parsing, invite notice, guideline edit
**Date**: 2026-10-30
**Complexity Level**: C1
**Risk Level**: Medium (session storage / logout path)
**Priority**: P3
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-108
**Brainstorming**: `BRAINSTORMING_LOG_m013-mobile-debt.md` (Path C + F12, auto-debated)

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> A user who signs out stays signed out even when a SecureStore delete fails; the app never redirects during render; a login/signup error with a non-JSON body shows a readable message; accepting an invite while signed in tells the user who they are signed in as (web parity); "Edit guideline" from the detail view opens the form.

Restated intent confirmed: auto (Supervisor).

**Cut list (Simplicity First)** — closed as won't-fix, recorded in `tasks/TASK_REVIEW_M013.md`:
- F8 (serialise adapter writes): only production adapter writer is `src/theme.ts:86`; login/logout bypass the adapter. Revisit if a second adapter caller appears.
- F9 (web `auth.ts` lazy localStorage): works in browser + jsdom; `apps/web` is the other board.
- F13a (no Bearer on invite accept): `POST /users/invite/accept` has no guard (`apps/api/src/users/users.controller.ts:33`), so the header is ignored and cannot cause a 401.
- 401 redirect: already done in M012 (`src/api.ts:277`).

---

## Dependencies & Reachability

**Depends on**: M012 (storage/401 hardening), M005 (forms), M010 (`ScreenFrame`)
**Entry point**: sign-out button (`app/dashboard.tsx`), 401 path (`src/api.ts` → `clearSession`), `app/index.tsx`, `app/invite/accept.tsx`, `app/guidelines.tsx`
**Consumer**: every mobile user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `clearSession()` on native deletes the legacy `accessToken`/`authUser` keys **before** the `session` key; a test where a legacy delete rejects shows the next hydration does **not** restore a token | F7 |
| 2 | If `deleteItemAsync('session')` rejects, `clearSession` falls back to writing the empty state (`{accessToken:null,authUser:null}`) to `session`; test: delete rejects → next hydration yields no token. Memory is cleared and listeners notified regardless (existing behaviour kept) | M012 residual |
| 3 | `storage.ts` parse-failure log passes the message only (`error instanceof Error ? error.message : 'unknown error'`), never the error object — test asserts `console.warn` args contain no raw blob | M012 residual |
| 4 | `storage.ts` imports `ACCESS_TOKEN_STORAGE_KEY`/`AUTH_USER_STORAGE_KEY` from `@kitchenos/shared` instead of redefining them | F12 |
| 5 | `app/dashboard.tsx` no longer calls `router.replace` during render (use `<Redirect href="/" />` from expo-router or a `useEffect`); test: no user → redirect to `/`, no render-phase navigation | F10 |
| 6 | `app/index.tsx` login/signup tolerate a non-JSON error body (e.g. HTML 502): user sees `Request failed (<status>)`, not a JSON SyntaxError; JSON `message` still shown when present. **Do not route login through `request()`** (its 401 handler fires when both tokens are null) | F11 |
| 7 | `app/invite/accept.tsx` shows a notice "You are signed in as <email>. Accepting this invitation will sign you in as the invited user." when a user is signed in at mount (read once, like web `AcceptInvitePage.tsx:25-28`); accept still proceeds; no notice when signed out | F13b |
| 8 | `app/guidelines.tsx`: pressing "Edit guideline" on the detail view shows the prefilled edit form (leave detail mode or render the form there); test covers detail → Edit → form visible with the guideline's title | M005 residual |
| 9 | Every AC above has a test that **fails before** the change (TDD; paste the failing run as BEFORE); mobile test + typecheck pass | test-first |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M013.md`.

---

## Edge cases (from brainstorming)
- Legacy delete throws → `session` still gone, legacy keys don't resurrect.
- `session` delete throws → empty-state overwrite; if *that* also throws, warn (message only) and still resolve memory-cleared state as today.
- Hydration race guard (`nativeWriteVersion`) must keep working — existing `storage.test.ts` must stay green.
- Non-JSON body on a 200 (shouldn't happen) — keep current behaviour, don't over-handle.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/storage.ts` | AC1–4 |
| `apps/mobile/app/dashboard.tsx` | AC5 |
| `apps/mobile/app/index.tsx` | AC6 |
| `apps/mobile/app/invite/accept.tsx` | AC7 |
| `apps/mobile/app/guidelines.tsx` | AC8 |
| `apps/mobile/src/*.test.ts(x)` | tests per AC |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/api.ts` (`request()`) | 401 path is M012's; out of scope |
| `apps/mobile/src/theme.ts` | F8 cut |
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |

---

## Completion checklist
- [ ] Implementation done
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Smoke test confirmed (device check pending — human)
- [ ] `memory/` updated (Supervisor, if new patterns)
- [ ] TASK_GUIDE marked complete
