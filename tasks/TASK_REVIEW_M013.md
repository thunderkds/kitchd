# TASK_REVIEW — M013: Mobile P3 debt — logout durability, render-time redirect, login error parsing, invite notice, guideline edit

> Sibling of `tasks/TASK_GUIDE_M013.md`. Filled by the Supervisor at Stage 4/5.

---

## Auto decisions

Mode: auto
1. Picked M013 as the next task (web board all Done; mobile Wave E backlog, debt before features) — RULE: `PROJECT_KANBAN_mobile.md` § Wave A "pay down the M000 debt (must clear before new features)"
2. Risk Medium (session storage / logout path) — RULE: `CLAUDE.md` § Risk Level Criteria "Medium | … involves state management or API contracts"
3. Scope = Path C + F12: fix F7, delete-failure, parse-log, F10, F11 (in place), F12, F13b, guideline edit; cut F8, F9, F13a — DEBATED: Path C + F12 (Advocate 1: A, fix everything incl. a write queue and a `request()` public-route option; Advocate 2: C, user/security-visible items only). Advocate 1's main F8 claim (login writes through the adapter) was checked and is false: the only adapter writer is `apps/mobile/src/theme.ts:86` ⚠ decided for you — please review
4. F13a (Bearer on invite accept) closed as harmless — FACT: `apps/api/src/users/users.controller.ts:33` "@Post('invite/accept')" carries no `@UseGuards` (unlike `:27` "@UseGuards(JwtAuthGuard, RolesGuard)"), so the header is ignored and cannot 401
5. F13b: warn and proceed, not block — FACT: `apps/web/src/routes/pages/AcceptInvitePage.tsx:81` "You are signed in as {currentUser.email}. Accepting this invitation will sign you"
6. 401 redirect item dropped as already done — FACT: `apps/mobile/src/api.ts:277` "redirectToSignIn();"
7. AC3 deviation accepted: log `error.name`, not `error.message` — FACT: on Node v26 V8's SyntaxError message quotes the input (`Unexpected token 's', "secret-token-abc" is not valid JSON`), so the literal AC would still leak the token; the AC's testable condition (no raw blob in the log) is what was asked
8. `clearSession` now resolves on SecureStore failure (3 existing tests updated) — RULE: `tasks/TASK_GUIDE_M013.md` § Edge cases "if *that* also throws, warn (message only) and still resolve"
9. Spawned on this session's CLI/model without `craft-spawn-prompt` — process miss, logged as code-review P1 (no `Startup reads:` line). SAFER OPTION: no code impact; future spawns use `craft-spawn-prompt` ⚠ decided for you — please review
10. Merged `task/M013` into `feat/m001-pnpm-workspace` (local, not pushed) — RULE: same flow as M004–M017 (`PROJECT_KANBAN_mobile.md` § Done)
Checks: tests `pnpm --filter @kitchenos/mobile test` — 48/48 suites, 461/461 tests (post-merge); typecheck clean; reviews code-review — 0 P0, 1 P1 (process), 1 P2, 3 P3; security-review — no findings; real run `npx expo export --platform ios` — printed `Exported: …/m013-export` (auto-checked, not /verify)
Not done: push (yours); device check on a simulator/phone (yours, as for M004–M017); P3 suggestions below; `fewer-permission-prompts`/`update-config` setup skipped (RULE: tracks.md stop #5)

## Review findings (code-review, `reports/code-review_task-M013_20261030T105831.html`)

| Sev | Where | Finding | Outcome |
|-----|-------|---------|---------|
| P1 | process | Spawn prompt hand-written, no Startup reads block / line | recorded; no code fix |
| P2 | guide | C1 label exceeded by lane check (14 files; 1505 of 1863 lines are the BEFORE capture, rest mostly tests) | noted |
| P3 | `apps/mobile/src/storage.ts:239` | all-deletes-succeed path deletes `session` after the awaits; a login landing mid-logout could lose its persisted blob (pre-existing) | suggestion |
| P3 | `apps/mobile/app/invite/accept.tsx:70` | notice omits web wording "sign you out of that account" | suggestion |
| P3 | `tasks/M013_BEFORE.txt` | raw 1505-line jest output | suggestion |

Security review (`reports/security-review_task-M013_20261030T105928.html`): no findings ≥ 8/10.

## Won't-fix (cut list)
- **F8** serialise adapter writes — only adapter writer is `src/theme.ts:86`; login/logout bypass it. **Revisit if a second adapter caller appears.**
- **F9** web `auth.ts` lazy localStorage — works in browser and jsdom; `apps/web` is the other board.
- **F13a** Bearer on invite accept — public route has no guard (decision 4).

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/mobile/src/storage.test.ts` (AC1–4), `src/dashboardRedirect.test.tsx` (AC5), `src/loginErrorBody.test.tsx` (AC6), `src/inviteAcceptScreen.test.tsx` (AC7), `src/recipeGuidelineEdit.test.tsx` (AC8) — pass |
| Verification command run | ☑ pass | `Test Suites: 48 passed, 48 total` / `Tests: 461 passed, 461 total`; typecheck clean (needs `pnpm --filter @kitchenos/shared build` in a fresh worktree) |
| Negative cases hold | ☑ pass | legacy delete rejects → no token on next hydrate; session delete rejects → empty blob; both writes fail → resolves, message-only warn; HTML 502 → `Request failed (502)` |
| verify | ☑ N/A | no simulator here; auto-checked by tests + `expo export --platform ios` bundle — pass; device check pending (human) |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | 13 changed mobile files + `clearSession` callers (`src/api.ts:273`, `app/dashboard.tsx:79`) + their tests |
| Full smoke suite still green (no regression) | ☑ pass | 461/461 post-merge (baseline 447 + 14 new) |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | text notice + mode switch only; no simulator |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | accept screen is still hard-coded dark (M018 scope) |
| **UI: Responsiveness at target viewports** | ☑ N/A | no layout change |

---

## Demonstration

**BEFORE**: `tasks/M013_BEFORE.txt` (captured `date -u` before any source change): `Tests: 13 failed, 448 passed, 461 total` — the 13 failures are exactly the new M013 tests (e.g. "AC1: a failed legacy delete does not let the next hydration restore a token", "shows \"Request failed (502)\" when the error body is HTML").

**AFTER**: `Tests: 461 passed, 461 total` on `task/M013` (497cc6c) and again after merging into `feat/m001-pnpm-workspace`.

**DELTA**: A user who signs out stays signed out even when SecureStore deletes fail, a login behind an HTML error page shows `Request failed (502)` instead of a JSON error, invitees who are already signed in are told whose session will be replaced, and "Edit guideline" opens the form.

**WITNESS**: Supervisor re-ran the suite on the task branch and post-merge, 2026-10-30; implementing agent captured BEFORE.
