# RUNBOOK — KitchenOS
**Last updated**: 2026-07-06

> Operational runbook: how to deploy, verify, and recover this service. Written/appended by the `ship` skill after Stage 5 verification, and kept current by whoever last touched the deploy path. This is the document an operator opens at 3am — every command must be copy-pasteable and every check must have a pass condition.

---

## Service Identity

- **Name**: KitchenOS (`apps/api` NestJS backend, `apps/web` React frontend, `packages/shared` shared types)
- **Repo**: `github.com/thunderkds/kitchd` (local: `/home/hungnguyenhuu/workspace/pets/hungnguyen111/kitchd`)
- **Deployment target**: Render staging (auto-deploy on merge to `staging` branch, via `.github/workflows/deploy-staging.yml`). Production/`main` deploy explicitly out of scope for this milestone.
- **Tech**: TypeScript monorepo — NestJS + Prisma + PostgreSQL (api), React + Vite (web)
- **Owner / on-call**: Solo founder (hungnh1110@gmail.com)

---

## Deploy Procedure

Ordered steps to ship a release. Migrations before app. Commands copy-pasteable.

### One-time setup (required before the FIRST staging deploy — not yet done)

1. Create a Render Postgres instance and two Render Web Services (one for `apps/api`, one for `apps/web`), or the Render Blueprint equivalent.
2. On the API service, set environment variables: `DATABASE_URL` (Render Postgres connection string), `JWT_SECRET` (a real random secret — **never** the `dev-only-change-me` default in `apps/api/.env.example`), `JWT_EXPIRES_IN=1d`, `PORT` (Render sets this automatically, usually `10000`).
3. On the web service, set `VITE_API_BASE_URL` to the API service's public Render URL.
4. Grab each service's **Deploy Hook URL** from Render's dashboard (Settings → Deploy Hook).
5. Add these as GitHub repo secrets (`Settings → Secrets and variables → Actions`):
   - `RENDER_DEPLOY_HOOK_WEB`, `RENDER_DEPLOY_HOOK_API`
   - `STAGING_DATABASE_URL` (same Postgres connection string as step 2, used by the CD workflow to run `prisma migrate deploy` before triggering the API deploy hook)
   - Optional: `RENDER_API_KEY`, `RENDER_SERVICE_ID_WEB`, `RENDER_SERVICE_ID_API` (enables the workflow's post-deploy status poll)

**TODO: confirm with operator** — none of the above has been done yet. This is the single blocking item before any staging deploy can succeed (see GO/NO-GO gate below).

### Per-release steps (once the above is done)

1. **Pre-deploy checks**: clean working tree on `develop`, all Stage 4/5 evidence green for every in-scope task (see Release Scope below), full test suite passing.
   ```bash
   git status --short          # expect clean
   npm --prefix apps/api run test   # expect all green
   npm --prefix apps/web run test   # expect all green
   ```
2. **Merge `develop` into `staging`** — this is the actual deploy trigger (per `deploy-staging.yml`'s `on: push: branches: [staging]`):
   ```bash
   git checkout staging
   git pull origin staging
   git merge --no-ff develop
   git push origin staging
   ```
3. This push automatically triggers `.github/workflows/deploy-staging.yml`:
   - `guard-branch` job asserts the ref is `refs/heads/staging` (defense-in-depth, cannot deploy from any other branch).
   - `deploy-api` job runs `prisma migrate deploy` against `STAGING_DATABASE_URL`, then POSTs to `RENDER_DEPLOY_HOOK_API`.
   - `deploy-web` job POSTs to `RENDER_DEPLOY_HOOK_WEB`.
   - `verify-deploy` job polls Render's API for deploy status if `RENDER_API_KEY` + service IDs are set.
4. Watch the GitHub Actions run: `gh run watch` (or the Actions tab) until all jobs are green.
5. **Post-deploy health check**: `curl -fsS <API_RENDER_URL>/` → pass condition: HTTP 200 with body `Hello World!`. (No dedicated `/health` endpoint exists yet — see Common Failure Modes below for a follow-up recommendation.)
   ```bash
   curl -fsS -o /dev/null -w "%{http_code}\n" <API_RENDER_URL>/
   # expect: 200
   ```
6. Smoke-test the web app: open `<WEB_RENDER_URL>/login`, sign up or log in with a test account, confirm the Dashboard loads.

---

## Rollback Procedure

- **Trigger conditions**: health check fails (non-200 or timeout) for >2 minutes after deploy; error-rate spike visible in Render logs; `prisma migrate deploy` fails mid-migration; web app shows a blank page / JS error on load.
- **Reverse steps** (in order):
  1. Identify the last known-good commit on `staging` (the commit before the merge that broke it): `git log origin/staging --oneline`.
  2. Revert the merge commit on `staging` and push:
     ```bash
     git checkout staging
     git revert -m 1 <bad-merge-commit-sha>
     git push origin staging
     ```
     This re-triggers `deploy-staging.yml` and redeploys the prior good state via the same deploy-hook mechanism.
  3. **If a migration was applied and needs reversing**: all of this project's migrations so far are additive-only (new tables/columns, no drops) per each task's migration-safety GO verdict — reversal is a manual `prisma migrate resolve --rolled-back <migration_name>` plus a hand-written down-SQL only if the new columns/tables are actively causing errors (unlikely, since they're all nullable/additive). Check `apps/api/prisma/migrations/` for the specific migration and confirm nothing in `develop`'s current code depends on it before rolling back the schema.
  4. Manually trigger the Render deploy hooks again if the revert push doesn't auto-fire (e.g. `curl -X POST $RENDER_DEPLOY_HOOK_API` and `_WEB`) to force a redeploy of the reverted commit.
- **Verify rollback**: repeat the Post-deploy health check above → expect HTTP 200, and confirm the web app loads and login works against the reverted state.

---

## Health Checks & Dashboards

| Check | Command / URL | Pass condition |
|-------|---------------|-----------------|
| API liveness | `curl -fsS <API_RENDER_URL>/` | HTTP 200, body `Hello World!` |
| Web liveness | `curl -fsS -o /dev/null -w "%{http_code}" <WEB_RENDER_URL>/` | HTTP 200 |
| DB connectivity (indirect) | `curl -fsS <API_RENDER_URL>/auth/signup -X POST -d '{}' -H "Content-Type: application/json"` | HTTP 400 (validation error) — proves the API process is up and routing works; a 500/timeout instead suggests DB connectivity failure |
| CI status | `gh run list --branch staging --limit 1` | Latest run `completed` / `success` |

- **Dashboards**: Render service dashboards (per-service logs + metrics, accessed via the Render web console — URLs not yet created, see One-time setup above). GitHub Actions tab for CI/CD run history.

---

## Common Failure Modes & Remediation

| Symptom | Likely cause | Remediation |
|---------|-------------|--------------|
| `deploy-staging.yml` fails at "Trigger Render deploy hook" with `RENDER_DEPLOY_HOOK_*  secret is not set` | One-time Render setup (above) was never completed | Complete the One-time setup section, add the missing GitHub secret, re-push to `staging` |
| API returns 500 on every request after deploy | `DATABASE_URL`/`JWT_SECRET` env vars misconfigured on the Render service, or migration didn't apply | Check Render service env vars match `.env.example` shape; check the CD workflow's "Run Prisma migrations against staging DB" step log for migration errors |
| Web app loads blank / shows a CORS error in console | `VITE_API_BASE_URL` on the web service doesn't point at the actual deployed API URL, or `WEB_ORIGIN` env var on the API (used by `RealtimeGateway`'s CORS config) doesn't match the deployed web URL | Update the mismatched env var on the relevant Render service and redeploy |
| Socket.IO realtime features silently don't update live | `WEB_ORIGIN` CORS mismatch (see `apps/api/src/realtime/realtime.gateway.ts`) rejecting the handshake | Set `WEB_ORIGIN` on the API service to the deployed web URL |
| Nightly recurrence job doesn't generate tasks | `RecurrenceScheduler`'s in-process `setInterval` never survives a Render free-tier service that spins down when idle | If using Render's free tier, recurrence generation will not run reliably — either upgrade to an always-on plan or move recurrence to a real cron trigger (Render Cron Job) in a future task |

**Recommended follow-up (not blocking this release)**: add a dedicated `GET /health` endpoint that pings the DB (`SELECT 1`), so the health check above verifies DB connectivity directly instead of inferring it from a 400 on signup.

---

## On-Call / Escalation

1. **First responder**: Solo founder (hungnh1110@gmail.com) — no rotation, self-service project.
2. **Escalate to**: N/A (single-operator project).
3. **Comms**: N/A — no team channel yet.

---

## Release Log

| Version / Tag | Date | Scope (Task IDs) | Deployer | Outcome |
|---------------|------|-------------------|----------|---------|
| v0.1.0-mvp (proposed, not yet tagged) | 2026-07-06 | T001–T024 (full MVP: auth/RBAC, inventory, recipes, guidelines, tasks, notes, announcements, shift log, comments, notifications, dashboard, recurrence, realtime, CSV export, mobile responsive, CI/CD, QA pass, RBAC audit follow-up) | — (not yet deployed) | **Pending** — blocked on Render service creation + secrets (see Deploy Procedure One-time setup) |
