# TASK_GUIDE — T023: CI/CD — lint/test/build pipeline + Railway staging auto-deploy
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P1
**Assigned agent**: common-infrastructure
**Agent guide**: `.claude/agents/common-infrastructure.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/common-infrastructure.md`
5. C2 task — read `memory/codebase-map.md` if present

---

## Requirement (Pillar 1 — Adapt the requirement)

Automate the manual verify-then-deploy loop so the founder isn't hand-running lint/test/build and manually pushing to staging on every change.

**Restated intent**:
> A GitHub Actions CI workflow runs lint, typecheck, and the full test suite for `/apps/web` and `/apps/api` on every push and pull request. A separate CD workflow deploys to a Railway staging environment automatically, but ONLY on merge to the `staging` branch — never on merge to `main` (production deploy remains explicitly out of scope for this milestone, per `PRD.md` Out of Scope).

**Out of scope**:
- Any deploy to `main`/production — this task must not create a workflow trigger on `main` pushes
- Choosing/provisioning the production hosting story — that's a separate future decision

**Requirement Refs**:
- FR-024: CI on every push/PR; CD to Railway staging on merge to `staging` only
- US-013

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor, this task added after user flagged the missing CI/CD task and confirmed Railway + staging-only scope via forced-choice questions)
- [x] Domain terms align with `PROJECT_SPEC.md` (staging vs production distinction)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] All Requirement Refs exist in `PRD.md` and are covered by the Acceptance Criteria

> An agent must NOT start implementing until this gate is checked. If anything here is unclear, STOP and ask the Supervisor.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A push or PR to any branch triggers a CI workflow running lint, typecheck, and tests for both `/apps/web` and `/apps/api` | FR-024 |
| 2 | CI fails the workflow (non-zero exit) if lint, typecheck, or any test fails | FR-024 |
| 3 | A merge to `staging` triggers a CD workflow that deploys to Railway | FR-024 |
| 4 | A merge to `main` does NOT trigger any deploy | FR-024 — explicit negative requirement |
| 5 | Railway deploy credentials are stored as GitHub Actions secrets, never committed to the repo | Security baseline (implicit NFR) |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Open a PR with a passing test suite | CI workflow runs and passes (green check) | GitHub Actions run, pasted link/output |
| 2 | Open a PR with a deliberately failing test | CI workflow fails (red X) | GitHub Actions run, pasted link/output |
| 3 | Merge a commit to `staging` | CD workflow triggers, Railway shows a new deployment | Railway dashboard screenshot or deploy log, pasted |
| 4 | Merge a commit to `main` | No deploy workflow runs | Confirm via Actions tab — no CD run triggered for that push |
| 5 | `grep -r` for Railway tokens/API keys in the repo | No matches — all secrets referenced via `${{ secrets.* }}` | manual grep, pasted |

### Verification Command (exact, runnable)

```bash
# Local equivalent of what CI runs, to verify the scripts exist and pass before pushing
npm --prefix apps/web run lint && npm --prefix apps/web run test && npm --prefix apps/web run build && \
npm --prefix apps/api run lint && npm --prefix apps/api run test && npm --prefix apps/api run build
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | [workflow YAML files are the "test" here — paste paths] |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | [failing-test PR + main-branch-no-deploy cases] |
| verify | ☐ pass / ☐ fail | [confirm staging URL serves the deployed app] |
| Review scope bounded to the change's blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — pure CI/CD infra task | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

Two GitHub Actions workflows under `.github/workflows/`:
1. `ci.yml` — triggers on `push` and `pull_request` for all branches; matrix or sequential jobs for `apps/web` and `apps/api`, each running `npm ci`, lint, typecheck, test, build.
2. `deploy-staging.yml` — triggers on `push` to `staging` only (`branches: [staging]`), runs the Railway CLI/GitHub Action to deploy both `apps/web` and `apps/api` services. Railway project/service tokens stored as repo secrets (`RAILWAY_TOKEN` or per-service tokens), never hardcoded. No workflow in this task references `main` as a deploy trigger — confirm this explicitly since it's the one thing that must NOT happen.

---

## Edge Case Checklist

- [ ] A workflow accidentally triggering on `main` pushes is the single most important thing to catch — double-check the `on:` branch filter before considering this task done
- [ ] CI workflow failing due to a missing script (e.g. `apps/web` has no `lint` script yet) fails loudly with a clear error, not a silent skip
- [ ] Railway deploy failing (bad credentials, quota, etc.) fails the workflow visibly, not silently leaving staging on a stale deploy
- [ ] Secrets (Railway tokens) never appear in workflow logs (masked) or committed files

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | New — lint/typecheck/test/build on push+PR |
| `.github/workflows/deploy-staging.yml` | New — Railway deploy on merge to `staging` only |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Any workflow triggering on `main` | Explicitly out of scope — production deploy is deferred |
| `/apps/web/**`, `/apps/api/**` application code | This task only adds CI/CD config, no application changes |

---

## Test Plan

Open a throwaway PR to confirm CI runs and reports correctly (both pass and deliberately-broken cases); merge a test commit to `staging` to confirm the Railway deploy fires; confirm no workflow fires on a `main` push.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run (Medium risk — secrets handling)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (workflow run links count as evidence here)
- [ ] `Skill({ skill: "verify" })` run — staging URL confirmed serving the deployed app
- [ ] `memory/MEMORY.md` updated (Railway staging URL + workflow trigger rules recorded)
- [ ] Supervisor notified: task ready for Stage 4 review
