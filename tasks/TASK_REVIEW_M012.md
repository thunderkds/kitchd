# TASK_REVIEW — M012: Mobile session hardening

> Sibling of `tasks/TASK_GUIDE_M012.md`. Filled by the Supervisor, 2026-10-29. Implementer: mobile-developer agent (`1c0828f`, review fixes `db0803b`). Reviewer: independent qa-expert (code + security review, read-only, mutation checks).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Stale-401 race (review P2) fixed in M012, not deferred — FACT: reviewer reproduced a held request's 401 erasing a newer session; fix is one guard (`session.getToken() === token`) in `src/api.ts`.
2. `resolveApiBase` uses `new URL()` — FACT: Expo winter installs a spec `URL` global (`expo/src/winter/runtime.native.ts:21`); RN's fallback `Libraries/Blob/URL.js:138` also implements `hostname`, so no release-startup crash from the parse.
3. F4 component test deferred to M004 AC9 — RULE: no RN component-test library installed; M004 adds `@testing-library/react-native`.
4. Release builds now REQUIRE an `https://` `EXPO_PUBLIC_API_BASE_URL` (import-time throw) — FACT: `src/apiBase.ts`; must be set in EAS env before the first release build ⚠ flag for whoever sets up EAS.
Checks: tests — pass (76/76, exit 0); typecheck — pass (real types, stubs removed); security — PASS with follow-ups
Not done: P3 residuals → M013 (JSON.parse error-object log `storage.ts:75`; delete-failure leaves persisted blob (F7); no redirect to `/` after 401)

## Findings

| Sev | Where | Finding | Disposition |
|-----|-------|---------|-------------|
| P2 | `src/api.ts:255` | stale 401 clears a newer session | **fixed** `db0803b` + regression test |
| P2 | `src/storage.ts:85` | 2nd hydration version check untested (`if(false)` mutant survived) | **fixed** — 2 tests; mutant now killed |
| P3 | `src/api.ts:259` | warn logs whole error object | **fixed** — message only |
| P3 | `src/apiBase.ts` | case-sensitive scheme; `https://` with no host accepted | **fixed** — `new URL` + protocol/hostname |
| P3 | `src/storage.ts:75` | JSON.parse error object logged (may quote blob on V8) | → M013 |
| P3 | `signOut` + `clearSession` | delete failure leaves persisted blob | → M013 (F7) |
| P3 | `src/api.ts` | no navigation after 401 | → M013 |

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/mobile/src/{api,apiBase,signOut,inviteToken}.test.ts`, `storage.test.ts` (race tests) — pass |
| Verification command run | ☒ pass | Supervisor rerun: `Tests: 76 passed, 76 total`, test exit 0, typecheck exit 0 — pass |
| Negative cases hold | ☒ pass | Reviewer mutations: 401 guard removed → 2 fail; https check removed → 1 fail; version checks removed → 3 fail; 2nd check removed → 2 fail after fix — pass |
| verify | ☒ pass | Session-layer task, no simulator: tests + real typecheck (bogus `const v: number = View` rejected TS2322) — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | 13+5 files; callers of `request()`/`clearSession`/`persistSession` traced; lane `C2, FITS` — pass |
| Full smoke suite still green (no regression) | ☒ pass | web vitest 230/230 (implementer run); no web files touched — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no visual change — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no visual change — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no visual change — N/A |

## Demonstration

**BEFORE**: 401 left a stale signed-in user; release builds could silently call `http://localhost`; sign-out could throw unhandled; invite token field reset on every keystroke; `tsc` checked almost nothing; a pre-hydration login could be overwritten.

**AFTER**: all six fixed, each pinned by a test that fails on the old code.

**DELTA**: The mobile session boundary is test-guarded and the typecheck is real.

**WITNESS**: Supervisor (main session), 2026-10-29.
