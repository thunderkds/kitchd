# TASK_GUIDE — M001: Commit the monorepo to pnpm workspaces and restore a working Render build
**Date**: 2026-08-10
**Complexity Level**: C2
**Risk Level**: High
**Priority**: P0
**Assigned agent**: common-infrastructure
**Agent guide**: `.claude/agents/common-infrastructure.md`
**Board**: `PROJECT_KANBAN_mobile.md` (mobile scope — separate board per Hard-Stop Gate 4)

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/common-infrastructure.md`
5. This is **C2** — apply the matching process from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. C2 task: `memory/codebase-map.md` **does not exist in this repo** (known gap, never generated). Skip step 6 of the standard startup; orient from the "Files to Change" table below instead.

---

## Requirement (Pillar 1 — Adapt the requirement)

User request, verbatim: *"commit to the pnpm workspace, write the M001 guide"* — following the M001 board entry: the RN migration commit `5904b08` reversed the 2026-07-06 standalone-deploy decision and dropped the devDependency install flag, leaving the Render deploy path broken.

**Restated intent**:
> Make pnpm the single, unambiguous package manager for this monorepo, and make both `apps/api` and `apps/web` build and deploy correctly from the repo root as pnpm workspace members — including resolving the `@kitchenos/shared` package that `apps/web` now imports but never declares.

**Out of scope** (this task explicitly does NOT do):
- Migrating `apps/mobile` deployment (Expo/EAS) — mobile is never built by Render
- Changing any application/product behavior, or any file under `apps/*/src`, other than the missing dependency declarations
- Actually performing a Render deploy, or creating Render services/secrets (human-only — still blocked, same blocker as T023)
- Reverting `apps/web`'s dependency on `@kitchenos/shared` — the user has explicitly decided to keep it and commit to the workspace

**Requirement Refs**: none in `PRD.md` — this is infrastructure debt from commit `5904b08`, not a product requirement. Traceability is to the M001 board entry.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor; user chose "commit to the pnpm workspace" over restoring standalone builds)
- [x] Domain terms align with `PROJECT_SPEC.md` — infra task, no domain vocabulary involved
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] No Requirement Refs to cover (infra task; traces to the M001 board entry instead)

---

## Dependencies & Reachability

**Depends on**: None — `M000` (commit `5904b08`) is already merged into `feat/react-native-migration`; this task repairs it.

**Entry point**: `pnpm-workspace.yaml` — plus the `build` script in root `package.json`. This is the literal grep-able artifact that defines the workspace this task commits to.

**Consumer**: `Intentionally headless: build/deploy infrastructure — no backend route and no user-settable persisted field is added, so there is no frontend surface to reach.`

---

## Background — what is actually broken

Read this before planning. Four separate problems are tangled together; fixing only the visible one leaves the deploy broken.

1. **Two package managers are declared at once.** Root `package.json` declares npm `workspaces`, `pnpm-workspace.yaml` declares pnpm workspaces, and **both `package-lock.json` and `pnpm-lock.yaml` are git-tracked**. Whichever tool runs first wins, and CI and local dev can silently disagree.
2. **`apps/web` imports `@kitchenos/shared` but never declares it.** `apps/web/src/routes/auth.ts`, `routes/pages/LoginPage.tsx`, and `features/team/api.ts` all import it, yet `apps/web/package.json` has **no `@kitchenos/shared` entry**. It resolves locally only because the root `node_modules` hoists it. A Render build with `Root Directory: apps/web` has no root `node_modules` and will fail to resolve the import. This is the single most likely cause of a red deploy.
3. **`npm install --include=dev` was removed** from the `build` script of both `apps/api` and `apps/web`. That flag was the fix for failure #1 in the original Render debugging chain: Render sets `NODE_ENV=production`, so devDependencies (`tsc`, `nest`, `vite`) are skipped and the build fails. **pnpm has the same behavior** — `pnpm install` also skips devDependencies under `NODE_ENV=production`. The pnpm equivalent is `pnpm install --prod=false`. Do not assume the workspace install fixes this for free.
4. **`@kitchenos/shared` must be built before either app.** Its `package.json` points `main`/`types` at `dist/`, and it has its own `tsc -p tsconfig.json` build step. Any build order that compiles an app before the shared package will fail.

Historical context in `memory/decisions.md` (2026-07-06 entry, now superseded) and `memory/learnings.md` ("Full first-deploy debugging chain on Render") — read both; they list seven latent bugs that only appeared at deploy time.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Exactly one lockfile is tracked (`pnpm-lock.yaml`); `package-lock.json` is deleted and the root `package.json` no longer declares an npm `workspaces` field | "single, unambiguous package manager" |
| 2 | `apps/web/package.json` declares `"@kitchenos/shared": "workspace:*"` as a dependency (matching how `apps/mobile/package.json` already declares it) | "resolving the `@kitchenos/shared` package that `apps/web` imports but never declares" |
| 3 | From a clean checkout with no `node_modules`, `pnpm install --frozen-lockfile && pnpm run build` at the repo root builds shared → api → web with no error | "build correctly from the repo root as pnpm workspace members" |
| 4 | The same clean build succeeds with `NODE_ENV=production` set — i.e. devDependencies are still installed (`--prod=false` or equivalent) | Background item 3 — the dropped `--include=dev` flag |
| 5 | `.github/workflows/ci.yml` and `deploy-staging.yml` install via pnpm (`pnpm/action-setup` + `pnpm install --frozen-lockfile`, `cache: "pnpm"`) and both jobs pass on this branch | "single, unambiguous package manager" |
| 6 | A `render.yaml` blueprint (or, if a blueprint is rejected, `docs/deploy-render.md`) records the exact root-level Root Directory, Build Command, and Start Command for each of the two services | "make both apps deploy correctly" |
| 7 | **Negative**: `pnpm install --frozen-lockfile` fails loudly if `pnpm-lock.yaml` is out of sync with any `package.json` — verify by hand-editing a version, confirming the failure, then reverting | Guards against a silently-stale lockfile |
| 8 | **Negative**: `apps/mobile` is not built by the root `build` script and not referenced by any Render service | "mobile is never built by Render" |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Clean checkout, all `node_modules` removed | `pnpm install --frozen-lockfile && pnpm run build` exits 0; `packages/shared/dist/index.js`, `apps/api/dist/src/main.js`, and `apps/web/dist/index.html` all exist | app run (script below) |
| 2 | Same, with `NODE_ENV=production` exported | Build still exits 0 — devDeps present, `tsc`/`nest`/`vite` all resolve | app run (script below) |
| 3 | `pnpm-lock.yaml` hand-edited out of sync with a `package.json` | `pnpm install --frozen-lockfile` exits non-zero with a lockfile-mismatch error | manual, output pasted |
| 4 | Existing web test suite | 199/199 still green — this task must not change app behavior | automated test |
| 5 | `grep -r "package-lock" .github/ package.json` | No hits | automated |

### Verification Command (exact, runnable)

```bash
# Run from the repo root. Proves AC3, AC4, AC8 and Success Criteria 1, 2, 4.
set -e
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install --frozen-lockfile
NODE_ENV=production pnpm install --prod=false --frozen-lockfile
NODE_ENV=production pnpm run build
test -f packages/shared/dist/index.js
test -f apps/api/dist/src/main.js
test -f apps/web/dist/index.html
test ! -d apps/mobile/dist   # AC8 — mobile must not be built by the root build
pnpm --filter @kitchenos/web run test
echo "M001 VERIFICATION: pass"
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | [required before Done — see Test Plan for what "a test" means on an infra task] |
| Verification command run | ☐ pass / ☐ fail | [paste actual output] |
| Negative cases hold | ☐ pass / ☐ fail | [AC7 lockfile-drift failure + AC8 mobile-not-built] |
| verify | ☐ pass / ☐ fail / ☐ N/A | [must literally contain the word "pass" here — the merge gate scans this Notes column] |
| Review scope bounded to the change's blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | [expect 199/199 web] |
| **UI: Visual regression** | ☐ N/A | Pure infrastructure task — no UI component. Justification: no file under `apps/*/src` renders differently; AC requires the existing suite stay green. |
| **UI: Design-system compliance** | ☐ N/A | Same justification. |
| **UI: Responsiveness** | ☐ N/A | Same justification. |

---

## Approach

Work in this order — each step de-risks the next.

**Step 1 — Pick one package manager, visibly.**
Delete `package-lock.json`. Remove the `workspaces` field from root `package.json` (pnpm reads `pnpm-workspace.yaml`; leaving both is what created the ambiguity). Add `"packageManager": "pnpm@10.12.4"` to root `package.json` so CI and Corepack agree on a version. Confirm `pnpm-workspace.yaml` lists `apps/*` and `packages/*` — it already does.

**Step 2 — Declare the dependency that is currently implicit.**
Add `"@kitchenos/shared": "workspace:*"` to `apps/web/package.json` dependencies. Check whether `apps/api` also imports it (`grep -rn "@kitchenos/shared" apps/api/src`) and declare it there too if so. Do not rely on hoisting for anything.

**Step 3 — Rewrite the root scripts as pnpm filters.**
Replace `npm --prefix <dir> run <script>` with `pnpm --filter <package-name> run <script>` throughout root `package.json`. Note these are **package names, not directories** (`@kitchenos/shared`, `@kitchenos/mobile`, and whatever `apps/api` and `apps/web` actually call themselves — check first). The root `build` must keep shared-first ordering, or use `pnpm -r --filter ... build` with pnpm's topological ordering; either is fine, but state which you chose and why.

**Step 4 — Restore the devDependency guarantee.**
The dropped `npm install --include=dev` becomes `--prod=false` on the pnpm install. Put it where Render will actually run it (the service Build Command in `render.yaml`), not buried in a package `build` script — the original bug was that a build script assumed an install had already happened correctly.

**Step 5 — Convert CI.**
Both jobs in `ci.yml`: swap `cache: "npm"` → `cache: "pnpm"`, add `pnpm/action-setup@v4` **before** `actions/setup-node@v4` (setup-node's pnpm cache needs pnpm on PATH first — getting this order wrong is the classic failure), and `npm ci` → `pnpm install --frozen-lockfile`. Do the same for the `npm ci --prefix apps/api` step in `deploy-staging.yml`. Do not touch that workflow's branch guard or its trigger list — it is deliberately locked to `staging` and there is a comment saying so.

**Step 6 — Write down the Render configuration.**
Each service's Root Directory moves from `apps/api` / `apps/web` to the **repo root**, because a workspace install needs the root manifest and lockfile. Prefer a checked-in `render.yaml` blueprint over dashboard-only config, so the settings are reviewable — the original deploy chain included a dashboard typo (`api` instead of `apps/api`) that cost a debugging cycle precisely because it lived only in a web form.

---

## Edge Case Checklist

Treat each of these as a required test case, not a suggestion.

- [ ] `NODE_ENV=production` skips devDependencies under pnpm too — verify `tsc`, `nest`, and `vite` all still resolve after a production-mode install
- [ ] Build order: `@kitchenos/shared` must compile to `dist/` before `apps/api` or `apps/web` typecheck against it
- [ ] `apps/mobile` pulls in the full React Native toolchain — confirm it is excluded from the Render install/build, or deploy time and image size regress badly
- [ ] `pnpm-lock.yaml` was committed by a process that also left `package-lock.json` in place; confirm the pnpm lockfile is actually current (`pnpm install --frozen-lockfile` on a clean tree) rather than trusting that it was generated from the final state
- [ ] pnpm's default isolated `node_modules` layout is stricter than npm's hoisting — any package relying on an undeclared transitive dependency will now fail. `apps/web`'s missing `@kitchenos/shared` is one known instance; grep for others before declaring done
- [ ] Prisma generates a client into `node_modules/.prisma` — verify `prisma:generate` still resolves correctly under pnpm's symlinked layout, and that the generated client survives into the built API
- [ ] `packages/shared` emits CommonJS (`"module": "commonjs"`) while `apps/web` is `"type": "module"` — this works today, but confirm it still works after the resolution change rather than assuming
- [ ] `expo-secure-store` and other native deps must not be hoisted into a place the web build tries to resolve
- [ ] The `staging` branch is 130 commits behind `develop` and has never been used — do not attempt to fix that here, but do not write config that assumes it is current either

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `package.json` (root) | Remove `workspaces` field; add `packageManager`; convert all scripts from `npm --prefix` to `pnpm --filter` |
| `package-lock.json` | **Delete** — pnpm is now the only package manager |
| `apps/web/package.json` | Add `"@kitchenos/shared": "workspace:*"` dependency (currently imported but undeclared) |
| `apps/api/package.json` | Add the same dependency **only if** `apps/api/src` imports it — check first |
| `.github/workflows/ci.yml` | `pnpm/action-setup` before `setup-node`; `cache: "pnpm"`; `npm ci` → `pnpm install --frozen-lockfile`; `npm --prefix` → `pnpm --filter` |
| `.github/workflows/deploy-staging.yml` | Convert the `npm ci --prefix apps/api` install step only — **do not touch the branch guard or triggers** |
| `render.yaml` (new) | Blueprint for both services: root Root Directory, `pnpm install --frozen-lockfile --prod=false && pnpm --filter … build`, correct start commands |
| `pnpm-lock.yaml` | Regenerate if the dependency additions change it |
| `PROJECT_KANBAN_mobile.md` | Move M001 Todo → Ready for Review when done |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/web/src/**`, `apps/api/src/**`, `apps/mobile/**` | This is an infra task. Application behavior must not change — the 199/199 web suite staying green is the proof. |
| `.github/workflows/deploy-staging.yml` — the `on:` block and `guard-branch` job | Deliberately locked to `staging` with a comment saying never to widen it. Convert the install step only. |
| `packages/shared/src/**` | The session extraction is M002's review scope, not this task's. |
| `apps/api/prisma/migrations/**` | No schema change in this task. |

---

## Test Plan

An infra task still owes a test under Hard-Stop Gate 5 — "the build works" must be *executable and repeatable*, not a one-time manual observation. Satisfy it as follows:

1. **Automated build test (the required new test).** Commit the Verification Command above as `scripts/verify-build.sh`, executable, exiting non-zero on any failure. Add it to `ci.yml` as its own job so a future change that breaks the clean-install path fails CI rather than failing a deploy. This script *is* the new test artifact — paste its path and passing output into the Evidence table.
2. **Regression.** `pnpm --filter @kitchenos/web run test` → expect 199/199, and `apps/api`'s jest suite → expect its current count. Neither should change; this task touches no application source.
3. **Negative — lockfile drift (AC7).** Hand-edit a version in a `package.json`, run `pnpm install --frozen-lockfile`, confirm it exits non-zero, revert. Paste the error.
4. **Negative — mobile exclusion (AC8).** Confirm the root build produces no `apps/mobile` build output and that `render.yaml` names no mobile service.
5. **Not verifiable here.** A real Render deploy cannot be run — the services and secrets still do not exist (the same human blocker as T023). Record the deploy path as *configured and reviewed but not executed*, and do not let any Evidence row imply a live deploy was proven. State this explicitly in the Notes rather than leaving it ambiguous.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run — **required, this task is High risk** (it touches CI workflows and deploy configuration, which handle `STAGING_DATABASE_URL`, `RENDER_DEPLOY_HOOK_*`, and `RENDER_API_KEY` secrets)
- [ ] Lint passes
- [ ] Tests written AND pass — `scripts/verify-build.sh` output pasted into Evidence (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated (Supervisor writes; report findings rather than editing memory yourself)
- [ ] Supervisor notified: task ready for Stage 4 review
