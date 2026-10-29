# TASK_REVIEW — M002: Retro code + security review of the React Native migration

> Sibling of `tasks/TASK_GUIDE_M002.md`. Filled by the Supervisor, 2026-10-29. Reviewer: independent read-only agent (no implementer involvement); scope `58e5179..f95e26a` for `apps/mobile`, `packages/shared`, `apps/web/src/routes`, `apps/web/src/features/team/api.ts`, read at HEAD.

## Auto decisions

Mode: auto
1. P2 findings F1–F5 are fixed in a new task M012 (test-first on the M003 runner) instead of inside M002 — RULE: `tasks/TASK_GUIDE_M002.md` § Acceptance Criteria row 4 "P2/P3 findings are listed as follow-up rows (not fixed here)"
2. P3 findings F7–F13 grouped into one backlog row M013, not executed this session — SAFER OPTION: no P0/P1, keep scope surgical ⚠ decided for you — please review
3. `apiBase` http/localhost fallback (F2) is P2 today but must be P1 before the first EAS/release build — FACT: `apps/mobile/src/apiBase.ts:3` falls back to `http://localhost:3000` with no `__DEV__` guard
Checks: review — pass (0 P0, 0 P1, 6 P2, 7 P3); security verdict PASS with follow-ups
Not done: P2 fixes → M012; P3 → M013

## Focus questions (AC2)

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Token only in SecureStore; cache cleared on logout? | **Yes** (native). Expo-web target uses localStorage (same as the web app) | `apps/mobile/src/storage.ts:49-51,56,161`; logout clears memory sync first `:175`, then deletes keys `:176-180` |
| 2 | Any read/request before hydration? | **No** — `RootLayout` renders `BootScreen` until `sessionReady` settles; `sessionReady` never rejects | `apps/mobile/app/_layout.tsx:35-50`; `storage.ts:91-93,141`. Gap: no 401 handling → stale user after JWT expiry (F1) |
| 3 | Legacy migration leaves token insecure / resurrects logout? | **No** insecure storage (legacy keys were already SecureStore). Narrow resurrection edge on partial delete failure (F7) | `storage.ts:57,72-86,176-180` |
| 4 | Production build can hit non-HTTPS/dev host? | **Yes** — silent fallback to `http://localhost:3000` / `http://10.0.2.2:3000`, no https check (F2) | `apps/mobile/src/apiBase.ts:3-11` |
| 5 | Web login/logout semantics changed? | **No** — same keys and logic; only `localStorage` captured at import (F9) | `packages/shared/src/session.ts:5-6,54-77`; `apps/web/src/routes/auth.ts:3` |

## Findings

**P0**: none. **P1**: none.

**P2** (→ M012)
| # | File:line | Finding |
|---|-----------|---------|
| F1 | `apps/mobile/src/api.ts:255` | 401 never clears the session; stale user shown, all calls fail |
| F2 | `apps/mobile/src/apiBase.ts:3-11` | prod build silently falls back to http localhost; any `http://` accepted |
| F3 | `apps/mobile/app/dashboard.tsx:15-18` | `clearSession()` throw → unhandled rejection, no navigation, persisted session survives |
| F4 | `apps/mobile/app/invite/accept.tsx:19-23` | effect resets the token field on every keystroke — deep-linked token uneditable |
| F5 | `apps/mobile/expo-env.d.ts:1-68` | ambient `any` stubs for react-native/expo-router/jsx-runtime → `mobile typecheck` checks almost nothing |
| F6 | `apps/mobile` | zero committed tests → closed by M003 |

**P3** (→ M013 backlog): F7 delete legacy keys before `session`; F8 serialise adapter writes; F9 web `auth.ts` lazy localStorage; F10 dashboard render-time `router.replace`; F11 login/signup via `request()` + non-JSON errors; F12 reuse shared key constants; F13 no Bearer on invite accept / confirm session replace.

## Security verdict

PASS with follow-ups. Native tokens only in SecureStore, memory wiped on logout, hydration gates routing, migration stays in SecureStore, no token logging. Residual: F2 (promote to P1 before release), logout undoable by SecureStore failure (F3/F7), stateless JWT valid ≤1 day after logout. Deep links carry only single-use invite tokens; prefer https universal/app links for distributed invites.

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ N/A | Review-only task; no code changed in M002. Regression tests for fixes land in M012 — N/A |
| Verification command run | ☒ pass | Supervisor ran mobile typecheck (pass), web vitest 230/230, web build — pass. Mobile tests: see M003 |
| Negative cases hold | ☒ pass | Hydration gate verified by reviewer at `_layout.tsx:35-50` — pass |
| verify | ☒ pass | Review artefact task; all 5 focus questions answered with path:line evidence — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Scope limited to the 5904b08/80a0bcf/f95e26a source paths + API auth for token lifetime — pass |
| Full smoke suite still green (no regression) | ☒ pass | No code changed — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | review-only — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | review-only — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | review-only — N/A |

## Demonstration

**BEFORE**: `PROJECT_KANBAN_mobile.md` M000 row: "Done (landed pre-pipeline — code exists, but unreviewed and untested)" — "⚠️ No TASK_GUIDE".

**AFTER**: this file — 5 focus questions answered, 13 findings classified, security verdict recorded.

**DELTA**: The RN migration's auth/session boundary has a recorded review and a security verdict; its defects are tracked (M012/M013) instead of unknown.

**WITNESS**: Supervisor (main session), 2026-10-29.
