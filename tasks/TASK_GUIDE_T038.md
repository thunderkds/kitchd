## Bug Fix Task Guide — T038

**Date**: 2026-07-20
**Assigned agent**: Supervisor (fixed directly — root cause was already diagnosed and documented during T037's Stage 4 review)

### Mental Model (confirmed)
- Observed: CI's web build job fails. `npm run build` (`tsc -b && vite build`) errors on 4 test files: `TasksPage.test.tsx`, `Dashboard.test.tsx`, `cursor.test.tsx`, `responsive.test.tsx`.
- Expected: `npm run build` exits 0 and CI passes.
- Divergence point (three independent, unrelated typing gaps):
  1. `Dashboard.test.tsx`/`responsive.test.tsx`: their local `task()`/`makeTask()` test-fixture helpers never set `sourceRecipeId`/`sourceGuidelineId` (added to the `Task` type by T035) in the base object literal — the `: Task` return annotation then fails because `Partial<Task>` allows those keys to be `undefined`, not assignable to `string | null`.
  2. `cursor.test.tsx`: `container.querySelector('button[disabled]')` returns `Element | null`, which has no `.disabled` property (needs the generic argument `<HTMLButtonElement>`).
  3. `TasksPage.test.tsx`: `fetchMock.mock.calls.filter(([, init]: [string, RequestInit | undefined]) => ...)` — TS infers `mock.calls` as `any[][]`, and the destructured-tuple parameter type is stricter than `any[]`, so the callback signature doesn't satisfy `Array.prototype.filter`'s overloads.
- Recent context: root cause was found and confirmed via an isolated `git worktree` diff against `develop` during T037's Stage 4 code-review (documented in `tasks/TASK_GUIDE_T037.md` and `memory/learnings.md`'s 2026-07-20 "tsc -b vs tsc --noEmit vs vitest" entry) — the break has existed since T035 but was invisible to `vitest run` and `tsc --noEmit`, only surfacing in the full `tsc -b` project-references build that CI runs.

### Intake
- Trigger: `npm run build` in `apps/web`, or any CI run of the web build job.
- Severity: P1 (CI blocking, though the running app itself works fine — vitest and the dev server were never affected)
- Affected area: 4 test files only, no production code

### Complexity & Risk
- Complexity: C0 (test-file-only typing fixes, no logic change)
- Risk: Low

### Diagnosis Gates (Pillar 1 — must pass before any fix)
- [x] Phase 1 feedback loop: `npm run build` reproduces deterministically
- [x] Bug reproduces deterministically: confirmed via direct local run, and independently reproduced on a clean `develop` worktree before this session even started (see T037 review)
- [x] Root cause identified via direct code read of all 4 files — no instrumentation needed, error messages were precise and unambiguous

### Fix Gates (Pillar 2)
- [x] Fix applied: added `sourceRecipeId: null, sourceGuidelineId: null` to the two test-fixture helpers; added `<HTMLButtonElement>` generic to the `querySelector` call; changed the tuple-destructured filter predicate to index into `call[1]` with a cast instead of an incompatible parameter type annotation
- [x] `npm run build` passes clean (`tsc -b && vite build` — verified, output pasted below)
- [x] Full vitest suite still green (156/156, no regression — these were type-only fixes)

### Cleanup Checklist (Pillar 3)
- [x] No debug instrumentation added
- [x] Root cause stated in commit message
- [x] Post-mortem: `npm run build`/`tsc -b` should be added to CI's regular verification loop (or confirmed already present and alerting) so this class of test-fixture typing drift is caught at merge time, not discovered later via a separate CI failure report

### Evidence
| Check | Command / observation | Result |
|---|---|---|
| Repro loop | `cd apps/web && npm run build` | Pre-fix: fails with 4 TS errors (pasted above). Post-fix: `✓ built in 185ms`. |
| Regression test | `cd apps/web && npx vitest run` | Test Files 28 passed (28), Tests 156 passed (156) — no test behavior changed, only type annotations |
| Smoke suite | Same as above (full suite) | pass |
