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

### One-time setup (required before the FIRST staging deploy)

1. Create a Render Postgres instance and two Render Web Services (one for `apps/api`, one for `apps/web`), or the Render Blueprint equivalent.
2. **Per-service Render dashboard config** (both `apps/api` and `apps/web` are now fully standalone npm projects — no monorepo-root install step required):
   - **API service**: Root Directory `apps/api`; Build Command `npm run build`; Start Command `npm start`.
   - **Web service**: Root Directory `apps/web`; Build Command `npm run build`; Start Command `npm start`.
   - Both `build` scripts run `npm install --include=dev` internally — **required** because Render sets `NODE_ENV=production` during builds, which makes a plain `npm install`/`npm ci` skip `devDependencies` (this broke the first deploy attempt: `tsc` couldn't find `vite/client`/`node` type declarations, since `vite`/`@types/node`/`typescript` are all devDependencies). Don't remove the `npm install --include=dev &&` prefix from either build script.
3. On the API service, set environment variables: `DATABASE_URL` (Render Postgres connection string), `JWT_SECRET` (a real random secret — **never** the `dev-only-change-me` default in `apps/api/.env.example`), `JWT_EXPIRES_IN=1d`. Render sets `PORT` automatically.
4. On the web service, set `VITE_API_BASE_URL` to the API service's public Render URL (must be set at **build** time, since Vite bakes `import.meta.env.VITE_*` into the bundle — a post-build env var change requires a rebuild, not just a restart).
5. On the API service, set `WEB_ORIGIN` to the web service's public Render URL (used by `RealtimeGateway`'s CORS config — a mismatch here silently breaks Socket.IO's handshake, see Common Failure Modes).
6. *(Optional, for the GitHub Actions CD path instead of/in addition to manual Render dashboard deploys)*: grab each service's Deploy Hook URL (Settings → Deploy Hook) and add as GitHub repo secrets — `RENDER_DEPLOY_HOOK_WEB`, `RENDER_DEPLOY_HOOK_API`, `STAGING_DATABASE_URL`, optionally `RENDER_API_KEY` + `RENDER_SERVICE_ID_WEB`/`_API`. This lets `.github/workflows/deploy-staging.yml` auto-deploy on merge to `staging`, on top of Render's own auto-deploy-on-push-to-connected-branch behavior.

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
| `error TS2688: Cannot find type definition file for 'vite/client'`/`'node'` during `apps/web` build; or `nest build` fails needing `@nestjs/cli` during `apps/api` build | **Hit on the first real deploy (2026-07-06)**. Render sets `NODE_ENV=production` during builds, so a plain `npm install`/`npm ci` skips `devDependencies` — but `vite`, `@types/node`, `typescript` (web) and `@nestjs/cli` (api) are all devDependencies needed just to build. | Already fixed: both `apps/api` and `apps/web`'s `build` scripts now run `npm install --include=dev` explicitly before the actual build step. If this regresses, check that prefix wasn't accidentally removed from either `package.json`. |
| `apps/api` fails to start with `Cannot find module '/opt/render/project/src/dist/main'` | `start`/`start:prod` pointed at `dist/main` but `nest build`'s actual compiled entry is `dist/src/main.js` (tsc's inferred rootDir nests `src/` under `outDir`) — this was wrong since the scripts were first written. | Already fixed: both scripts now run `node dist/src/main`. If you ever change `tsconfig.build.json`'s `rootDir`/`outDir`, verify the real output path with `ls dist/` before assuming `dist/main.js`. |
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
