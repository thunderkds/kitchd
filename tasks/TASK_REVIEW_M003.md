# TASK_REVIEW — M003: Mobile test foundation

> Sibling of `tasks/TASK_GUIDE_M003.md`. Filled by the Supervisor, 2026-10-29. Implementer: qa-expert agent. Commits `3e130aa`, `5590b42`.

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Runner = jest-expo with `@react-native/jest-preset ~0.86.2` — FACT: jest-expo 57.0.4 peer-requires `^0.86.2`; react-native 0.86.0 pins `0.86.0` → one unmet-peer warning, same class as the existing `@react-native/metro-config` warning. Silenced by bumping RN to 0.86.2+ later.
2. First hand-back REJECTED — FACT: Supervisor reran `pnpm --filter @kitchenos/mobile test` 4× → exit 1 every time (jest-expo lazy winter `fetch` getter logs after teardown). Agent had called it cosmetic. Fixed in `5590b42` (`jest.setup.js` replaces the lazy getter with a rejecting stub).
3. Hydration race at `storage.ts:60` pinned as `it.failing`, fixed in M012 (AC7) — RULE: M003 is test-only scope; M012 owns session hardening.
Checks: tests — pass (50/50, exit 0 ×3); typecheck — pass; web vitest 230/230
Not done: CI wiring for mobile tests (guide follow-up); clean-wipe install (frozen install passes)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/mobile/src/storage.test.ts` (26), `session.test.ts` (13), `shared-session.test.ts` (11), helper `src/testing/memorySecureStore.ts` — pass |
| Verification command run | ☒ pass | Supervisor: `pnpm --filter @kitchenos/mobile test` → run1=0 run2=0 run3=0; `Tests: 50 passed, 50 total` — pass |
| Negative cases hold | ☒ pass | Mutation check: M1 cache-write removed → 5 fail; M2 legacy delete removed → 1 fail; M3 migration persist removed → 4 fail; file restored clean — pass |
| verify | ☒ pass | Test-infra task: runner exit code 0 is the integration signal; typecheck `tsc --noEmit` clean — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `apps/mobile/{package.json,tsconfig.json,jest.config.js,jest.setup.js,src/*.test.ts,src/testing}` + lockfile (only jest-tree additions/re-keys, no version bumps) — pass |
| Full smoke suite still green (no regression) | ☒ pass | web vitest 36 files / 230 tests — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no UI — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no UI — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no UI — N/A |

## Demonstration

**BEFORE**: `apps/mobile` had zero tests; `jest` failed to start (jest-expo needs `@react-native/jest-preset`).

**AFTER**: `pnpm --filter @kitchenos/mobile test` → 3 suites, 50 tests, exit 0.

**DELTA**: The session/storage boundary reviewed in M002 is now under test, mutation-proven, and one latent hydration race is pinned for M012.

**WITNESS**: Supervisor (main session), 2026-10-29.
