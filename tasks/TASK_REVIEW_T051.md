# TASK_REVIEW — T051: Web dev server renders a blank page (shared is CJS)

> Sibling of `tasks/TASK_GUIDE_T051.md`. Filled by the Supervisor at Stage 4/5 (2026-10-29).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Stage 4 review by an independent reviewer agent; P0/P1 fixed before Done, P2s fixed where cheap, P3s recorded — RULE: `.claude/skills/code-review/SKILL.md` § Phase 4
2. Stage 5 verify done with a scripted headless-Chromium run against the live stack instead of easy-ui-mcp (its port 8766 is held by another process; web served on :8767) — SAFER OPTION: real browser against real API beats skipping UI verify ⚠ decided for you — please review
Checks: tests — pass; reviews code-review — pass; real run `node reports/evidence/T044-T051/verify-web.cjs` — printed the RESULTS block in `reports/evidence/T044-T051/verify-web-result.txt`
Not done: nothing pending for this task

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/scripts/smoke-dev.mjs` (`pnpm --filter @kitchenos/web run smoke:dev`) — shown failing on the old config ("not importable as ESM"), passing after — pass |
| Verification command run | ☒ pass | Guide's verification command run by the Supervisor; Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| Negative cases hold | ☒ pass | `vite build` + `vite preview` still serve the built app; vitest 230 green — pass |
| verify | ☒ pass | Live: before fix the page body was empty and vite logged "does not provide an export named 'createSessionStore'"; after `d1a9466` the app mounts and the whole T044–T049 browser run passed on the same dev server — pass. Supervisor ran `node reports/evidence/T044-T051/verify-web.cjs` (headless Chromium, live API :3000 + vite dev :8767, real Postgres) at 2026-10-29T07:21Z; output in `reports/evidence/T044-T051/verify-web-result.txt` |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed `f95e26a..edbf1b6 -- apps/web` + direct callers and the backend controllers each feature calls (contract check); everything else skipped as outside the blast radius — pass |
| Full smoke suite still green (no regression) | ☒ pass | Supervisor ran full suites on `feat/m001-pnpm-workspace` after all fixes: web vitest `Test Files 36 passed (36) / Tests 230 passed (230)`, web build `✓ built`, API jest `26 suites / 222 tests passed` — pass |
| **Companion score (easy-verifier)** | ☑ N/A | easy-verifier companion not run this session (no `report:` path) — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | App shell renders (all screenshots) — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | N/A — config-only change, pass |
| **UI: Responsiveness at target viewports** | ☒ pass | N/A — config-only change, pass |

---

## Demonstration

**BEFORE**:
```
2026-10-29T07:17:49Z
$ node dbg.cjs (headless chromium → http://localhost:8767/shift-logs, print body text)
console debug [vite] connecting...
console debug [vite] connected.
http://localhost:8767/shift-logs

--- vite log:
2:16:19 PM [vite] (client) [Unhandled error] SyntaxError: The requested module '/@fs/home/hungnguyenhuu/workspace/pets/hungnguyen111/kitchd/packages/shared/dist/index.js' does not provide an export named 'createSessionStore'
```

**AFTER**: smoke:dev ok; dev server renders /login and authenticated pages — see `reports/evidence/T044-T051/verify-web-result.txt`.

**DELTA**: `pnpm dev:web` works again; local development and UI verification were impossible since 5904b08.

**WITNESS**: Supervisor (main session), 2026-10-29 — independent of the implementing agent; trace in `memory/event-trace/`.
