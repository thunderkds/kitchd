# BRAINSTORMING_LOG — M013: mobile P3 debt (M002 F7–F13, M012/M005 residuals)
**Date**: 2026-10-30 · **Tier**: Lightweight-Standard · **Risk**: Medium (session storage / logout) · **Mode**: auto

## The Problem Space
M013 bundles P3 follow-ups from three reviews (`tasks/TASK_REVIEW_M002.md:37`, `tasks/TASK_REVIEW_M012.md:20-24`,
`tasks/TASK_REVIEW_M005.md:14`). Verified against the code on 2026-10-30:

| Item | State | Where |
|------|-------|-------|
| 401 → redirect to sign-in | **already fixed** (M012) | `apps/mobile/src/api.ts:277` → `src/onUnauthorized.ts` |
| F7 legacy keys deleted after `session` → resurrection if a legacy delete fails | open | `apps/mobile/src/storage.ts:228-232` |
| `deleteItemAsync('session')` failure leaves the blob → next launch restores the session | open | `storage.ts:228` |
| JSON.parse error object logged (may quote the blob) | open | `storage.ts:76` |
| F8 adapter writes are fire-and-forget, unordered | open, **narrow**: only production caller is `src/theme.ts:86` | `storage.ts:127-150` |
| F9 web `auth.ts` captures `window.localStorage` at import | open; works in browser + jsdom; `apps/web` is the other board | `apps/web/src/routes/auth.ts:3` |
| F10 `router.replace('/')` during render | open | `apps/mobile/app/dashboard.tsx:17-19` |
| F11 login/signup raw fetch; `await res.json()` throws on non-JSON bodies | open | `apps/mobile/app/index.tsx:56-63` |
| F12 key constants duplicated instead of imported | open | `storage.ts:6-7` vs `packages/shared/src/session.ts:5-6` |
| F13a Bearer sent to public accept route | **harmless**: route has no guard, cannot 401 | `apps/api/src/users/users.controller.ts:33` |
| F13b accept replaces an existing session silently | open; web warns and proceeds | `apps/web/src/routes/pages/AcceptInvitePage.tsx:79-81` |
| Guideline detail → "Edit guideline" shows no form until Back | open | `apps/mobile/app/guidelines.tsx:87-92,143` |

## The Alternatives
- **A — Fix everything** (Advocate 1): per-item fixes + a write-serialising promise chain in `storage.ts` + a `request()` `{auth:false}` option for public routes + null-token 401 guard.
- **B — Rewrite the native storage layer** as one async session writer (unifies adapter + persist/clear paths). Rejected without debate: a refactor on the most security-sensitive file for P3 items; violates Surgical Changes.
- **C — Fix what users or security can notice** (Advocate 2): F7, delete-failure, log, F10, F11 in place, F13b, guideline edit; close F8/F9/F12 as won't-fix with written rationale.

## Adversarial Review
- **A fails if** the `request()` change regresses 401 handling for authenticated calls (the core of M012), or the write chain sticks/swallows errors. Advocate 1's main F8 argument ("login writes token then user through the adapter") is **false** — login goes through `persistSession` (`storage.ts:186`), which bypasses the adapter.
- **C fails if** a second adapter caller appears and F8 becomes reachable, or the closed items are forgotten. Containment: won't-fix lines in the TASK_REVIEW with a revisit trigger.

## 50% Rule Check
C is the 50%-less-code path. F12 is kept anyway: it *deletes* two lines and removes the risk of the migration reading different keys from the shared store.

## Recommended Path
**C + F12.** F11 is fixed in place in `index.tsx` (safe-parse, no `request()` change — avoids the null-token 401 trap). F13a closed as harmless (cited). F13b mirrors web: show a "signed in as X" notice and proceed.

## Surgical Scope
Touch: `apps/mobile/src/storage.ts`, `apps/mobile/app/{dashboard,index,guidelines}.tsx`, `apps/mobile/app/invite/accept.tsx`, matching tests in `apps/mobile/src/`.
Must not touch: `apps/mobile/src/api.ts` `request()`, `apps/web/**`, `apps/api/**`, `packages/shared/**`.

## Edge Case Checklist for TASK_GUIDE
- Legacy-key delete throws → `session` blob must still be gone *and* legacy keys must not resurrect on next hydrate.
- `session` delete throws → next hydrate must not restore a token (overwrite the blob with the empty state as fallback).
- Non-JSON error body (HTML 502) on login → readable error message, no crash.
- Dashboard with no user → redirect happens after render, no React "update during render" warning.
- Invite accept while signed in → notice shows current email; accept still works; not signed in → no notice.
- Guideline detail → Edit → form visible with prefilled values; Save returns to a sane state.

## Next Actions
TASK_GUIDE_M013 → worktree `../kitchd-M013` on `task/M013` → mobile-developer (tdd) → code-review + security-review → merge.

## User Selection
Auto mode: Path C + F12 — DEBATED (Advocate 1: A; Advocate 2: C) ⚠ decided for you — please review.
