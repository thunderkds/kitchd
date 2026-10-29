# TASK_GUIDE — M003: Test foundation for `apps/mobile`
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P0
**Assigned agent**: qa-expert (mobile-developer may assist)
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-97

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` (testing section)
2. Read `memory/MEMORY.md` (mobile entries: session persistence atomic, legacy session storage)
3. Read this file completely

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> `apps/mobile` gets a working test runner, wired as `pnpm --filter @kitchenos/mobile test`, with unit tests covering the auth/session boundary: `apps/mobile/src/session.ts`, `apps/mobile/src/storage.ts`, and `packages/shared/src/session.ts`.

**Current state (2026-10-29)**: uncommitted work-in-progress already exists in the main tree — `apps/mobile/jest.config.js` (preset `jest-expo`), `src/session.test.ts`, `src/shared-session.test.ts`, `src/storage.test.ts`, plus `jest`, `jest-expo`, `@types/jest` devDependencies and a `test` script. It does not run: `jest-expo` 57 needs its peer `@react-native/jest-preset` ("The React Native Jest preset that jest-expo relies on has moved to a separate package").

**Runner decision**: keep `jest-expo` (the Expo-supported preset; `apps/api` is already jest). Vitest is rejected: RN modules ship Flow/untranspiled code that `jest-expo`'s transform handles out of the box.

**Out of scope**:
- Screen/component tests (later tasks)
- CI wiring for mobile tests (record as a follow-up)
- Any change to `session.ts` / `storage.ts` behaviour — if a test exposes a real bug, mark the test `it.failing` or skip with a reason, and **report** it; the fix belongs to M002.

---

## Dependencies & Reachability

**Depends on**: M001 (pnpm workspace)
**Entry point**: `apps/mobile/jest.config.js`
**Consumer**: `pnpm --filter @kitchenos/mobile test`

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `pnpm --filter @kitchenos/mobile test` runs and passes from a clean `pnpm install --frozen-lockfile` | "working test runner" |
| 2 | `storage.ts` tests cover: secure-store write+read, in-memory cache hit, legacy-storage migration path (`f95e26a`), and the atomic-write/failure path (`80a0bcf`) | "cover storage.ts" |
| 3 | `session.ts` tests cover set/get/clear token + user and the `sessionReady` hydration (cold start before hydrate vs after) | "cover session.ts" |
| 4 | `packages/shared/src/session.ts` (`createSessionStore`) tests cover get/set/clear token, set/get user, malformed JSON user → null | "cover shared session" |
| 5 | `pnpm --filter @kitchenos/mobile typecheck` still passes; `pnpm install --frozen-lockfile` passes (lockfile in sync) | no regression |
| 6 | Mutation check: break one guarded line in `storage.ts` (e.g. skip the cache write) → at least one test fails; restore | tests are real |

---

## Approach

Add `@react-native/jest-preset` (version matching `react-native` 0.86) as a devDependency of `apps/mobile`; keep the existing WIP tests, extend them to meet AC2–AC4. Mock `expo-secure-store` with an in-memory map (jest `moduleNameMapper` or `jest.mock`). Don't change `pnpm-workspace.yaml` (its uncommitted `dangerouslyAllowAllBuilds` line is not part of this task — leave it uncommitted).

**Cut list**: no coverage thresholds, no CI job, no component tests.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/mobile/package.json` | test script + jest devDeps |
| `pnpm-lock.yaml` | lock the new devDeps |
| `apps/mobile/jest.config.js` | preset config, mocks |
| `apps/mobile/tsconfig.json` | `types: ["jest"]` |
| `apps/mobile/src/*.test.ts` | the tests |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/session.ts`, `storage.ts`, `packages/shared/src/session.ts` | test-only task; bugs go to M002 |
| `pnpm-workspace.yaml` | unrelated uncommitted change |
| `apps/web/**`, `apps/api/**` | out of scope |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/web exec vitest run
```

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M003.md`.

---

## Completion Checklist

- [ ] Runner works from clean install
- [ ] AC2–AC4 tests written and passing
- [ ] Mutation check recorded
- [ ] Supervisor notified: ready for Stage 4
