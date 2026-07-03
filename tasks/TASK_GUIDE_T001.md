# TASK_GUIDE — T001: Monorepo scaffold + auth skeleton
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P0
**Assigned agent**: common-infrastructure
**Agent guide**: `.claude/agents/common-infrastructure.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/common-infrastructure.md`
5. Note the Complexity Level above (C2) and apply the matching process from `.claude/agents/general-agent-template.md`
6. C2 task: read `memory/codebase-map.md` if it exists — skip if absent (greenfield, no code yet)

---

## Requirement (Pillar 1 — Adapt the requirement)

Scaffold the KitchenOS monorepo and stand up the minimal auth skeleton (signup/login/org creation) that every other task depends on.

**Restated intent**:
> A fresh clone of the repo can be installed and run locally, and a new user can sign up (creating an Organization + Kitchen + User) and log in with a JWT — with no RBAC enforcement yet (that's T002).

**Out of scope**:
- Role-based access control / RolesGuard (T002)
- Invite flow (T002)
- Any UI beyond a bare signup/login form
- Any non-auth domain entity (Recipe, Task, etc.)

**Requirement Refs**:
- NFR-006: Auth must use custom JWT with an org/role model (no third-party auth provider for MVP)
- NFR-003: Data model must be multi-tenant from day one (Organization → Kitchen → User)

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor, Stage 2 planning)
- [x] Domain terms align with `memory/glossary.md` (Organization, Kitchen, User)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] All Requirement Refs exist in `PRD.md` and are covered by the Acceptance Criteria

> An agent must NOT start implementing until this gate is checked. If anything here is unclear, STOP and ask the Supervisor.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Fresh clone + `docker compose up` + install + migrate produces a running API (`/apps/api`) and web dev server (`/apps/web`) | Foundation — enables all downstream tasks |
| 2 | Signing up with new credentials creates an Organization + Kitchen + User row and returns a valid JWT | NFR-006, NFR-003 |
| 3 | Logging in with existing credentials returns a valid JWT | NFR-006 |
| 4 | Signing up with invalid credentials (missing email/password) is rejected with a 4xx error | NFR-006 |
| 5 | Logging in with wrong credentials returns 401 | NFR-006 |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | `docker compose up` + `npm install` + migrate, on a clean checkout | API responds on its port, web dev server serves the app | manual + automated smoke test |
| 2 | POST /auth/signup with new email/password | 201 + JWT in response; Organization+Kitchen+User rows exist in DB | automated test |
| 3 | POST /auth/login with correct credentials | 200 + JWT | automated test |
| 4 | POST /auth/login with wrong password | 401 | automated test |
| 5 | POST /auth/signup with duplicate email | 409/4xx, no duplicate rows created | automated test |

### Verification Command (exact, runnable)

```bash
docker compose up -d && npm --prefix apps/api run migrate && npm --prefix apps/api run test -- auth
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ✅ pass | `apps/api/src/auth/auth.e2e.spec.ts` (AC2–AC5 + duplicate-email edge case, run against a real Postgres via a full Nest app instance), `apps/api/src/auth/guards/jwt-auth.guard.spec.ts` (malformed/empty JWT edge case → 401 not 500). 11 tests total, all passing. |
| Verification command run | ✅ pass | `docker compose up -d && npm --prefix apps/api run migrate && npm --prefix apps/api run test -- auth` run against a **freshly recreated** volume (`docker compose down -v` first, simulating a clean clone). Output: `Test Suites: 2 passed, 2 total / Tests: 10 passed, 10 total`. Full suite (`npm --prefix apps/api run test`, no filter): `3 passed, 3 total / 11 passed, 11 total`. |
| Negative cases hold | ✅ pass | Missing email → 400, missing password → 400, wrong password → 401, duplicate email → 409 with **no** partial Organization/Kitchen rows left behind (asserted via Prisma query in the same test — transactional signup), malformed/empty JWT → 401 not 500 (guard unit test). All also manually confirmed via curl against the running API. |
| `verify` skill — works in running app | ✅ pass | Manual run: `npm --prefix apps/api run start:dev` (port 3000) — `curl -X POST /auth/signup` returned 201 + JWT + user row; `curl -X POST /auth/login` (correct pw) returned 200 + JWT; wrong-password login returned 401; malformed signup body returned 400. `npm --prefix apps/api run build` (nest build) and `npm --prefix apps/web run build` (tsc -b && vite build) both succeed with zero errors. **Stage 4 follow-up (Supervisor)**: dev port changed 8765→8766 (host port conflict with an unrelated container), verified live — `npm --prefix apps/web run dev -- --port 8766` served HTTP 200 at `localhost:8766`. **Stage 5 re-verify (2026-07-03, Supervisor)**: `docker compose up -d` + `npm --prefix apps/api run migrate` (no pending migrations) + `npm --prefix apps/api run test -- auth` → 2 suites / 10 tests passing. Live API re-exercised via curl: signup → 201 + JWT (`accessToken` + `user.id/organizationId/kitchenId`); login correct → 200 + same JWT; login wrong password → 401 `Invalid credentials`; duplicate signup → 409 `Email already in use`. **Browser-driven UI walkthrough** (`easy-ui-mcp`, real Chromium against `http://localhost:8766`, screenshots captured): initial attempt blocked by the MCP container's Docker networking (no route to host); fixed by switching `easy-ui-mcp/docker-compose.yml` to `network_mode: host` and rebuilding — confirmed with `curl http://localhost:8765/health`. Retried the flow: signup form filled and submitted → page showed "Signed in as ui-verify2@kitchenos.test. Token: eyJh…"; along the way caught and fixed a stale local `apps/web/.env` (`VITE_API_BASE_URL` pointed at port 3001, an untracked/gitignored file, not a repo bug — API is on 3000) which had been causing a "Failed to fetch" error on first UI attempt. Log in with correct password → same signed-in state retained. Log in with wrong password → UI showed "Invalid credentials" in red, no token. All three flows confirmed visually via screenshot, evidence copied into this repo (not left in the external MCP repo) at:
  - `reports/evidence/T001/T001-ui-signup-success.png`
  - `reports/evidence/T001/T001-ui-login-success.png`
  - `reports/evidence/T001/T001-ui-login-wrong-password.png`
  - `reports/evidence/T001/T001-ui-session.json` / `.html` (full MCP session log/report)
  T001 has no design-system UI in scope (bare form only), so UI Evidence rows below remain N/A for visual-regression/design-system/responsiveness purposes, but the functional UI flow is now directly verified end-to-end. |
| Review scope bounded to the change's blast radius | ✅ pass | Greenfield scaffold — all files are new (no pre-existing code to bound against). |
| Full smoke suite still green (no regression) | ✅ pass | `npm --prefix apps/api run test` → 3 suites / 11 tests, all green (re-verified after Postgres port-binding fix, no regression). `npm --prefix apps/web run test` (Vitest, added during Stage 4 review) → 1 suite / 2 tests, all green. `npm --prefix apps/web run lint` (oxlint) and `npm --prefix apps/web run build` both clean. `npm --prefix apps/api run lint` (eslint --fix) clean. |
| **Stage 4 code-review** | ✅ pass | 1 P1 (apps/web missing test runner entirely — fixed, commit `fd14c67`), 2 P2 (JWT_SECRET fail-fast validation, auth rate-limiting — tracked, non-blocking). Report: `reports/code-review_task-T001-monorepo-scaffold_20260702T171500.html` |
| **Stage 4 security-review** | ✅ pass | 1 Medium (docker-compose.yml exposed Postgres to the local network via `0.0.0.0:5432` bind with default credentials — fixed, bound to `127.0.0.1`, commit `f492ee9`, re-verified via `docker port` + full auth suite re-run). Report: `reports/security-review_task-T001-monorepo-scaffold_20260702T172000.html` |
| UI: Visual regression | ☑ N/A — pure backend/infra task (bare signup/login form only, no design-system UI work in scope for T001) | |
| UI: Design-system compliance | ☑ N/A — pure backend/infra task | |
| UI: Responsiveness | ☑ N/A — pure backend/infra task | |

---

## Approach

Per `BRAINSTORMING_LOG.md` (Option B, approved): monorepo with `/apps/web` (React+TS+Vite+Tailwind), `/apps/api` (NestJS), `/packages/shared` (shared TS types/DTOs). Local PostgreSQL via Docker Compose. ORM: Prisma is recommended for NestJS-idiomatic migrations and type generation — confirm this choice explicitly in the task's implementation notes before locking it in (per Stage 1 checklist item 6, ORM was deferred to this task). Initial migrations cover Organization, Kitchen, User only, each with `org_id`/`kitchen_id` scoping per NFR-003. JWT signing via a standard NestJS JWT module; no RolesGuard yet — that's T002's job, so do not add permission checks here beyond "is authenticated."

**ORM decision — confirmed**: Prisma (as recommended). Rationale: first-class NestJS ecosystem support, declarative `schema.prisma` gives type-safe generated client + readable migration diffs, `prisma migrate dev`/`deploy` cleanly separates dev-time and deploy-time migration flows (needed for the `migrate` script used in the verification command and later CI/CD), and its transaction API (`$transaction`) made the transactional signup (Organization+Kitchen+User, all-or-nothing) straightforward. No alternative was seriously evaluated — the recommendation had no material downside for this MVP's scale.

**Dev server port**: configure Vite (`/apps/web`) to run on `localhost:8766` (set `server.port: 8766` in `vite.config.ts`). This is a fixed convention per `PROJECT_SPEC.md` Critical Constraints — every later FE task's UI Evidence capture (Playwright MCP) targets this exact port. Do not use Vite's default port.

---

## Edge Case Checklist

- [x] Duplicate email signup is rejected without leaving a partial Organization/Kitchen/User row (transactional) — verified via `auth.e2e.spec.ts`
- [x] Empty/malformed JWT on any route that requires auth returns 401, not a 500 — verified via `jwt-auth.guard.spec.ts`
- [x] DB migration run twice is idempotent (no error, no duplicate schema objects) — verified manually: `prisma migrate deploy` run twice, second run reports "No pending migrations to apply"
- [x] API starting before Docker Compose Postgres is ready — retries/backs off instead of crashing — `PrismaService.connectWithRetry()` retries up to 10x with 1s backoff on `onModuleInit`

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/web/**` | New React+TS+Vite+Tailwind app scaffold |
| `/apps/api/**` | New NestJS app scaffold, auth module |
| `/packages/shared/**` | New shared TS types/DTOs package |
| `docker-compose.yml` | Local Postgres service |
| `/apps/api/prisma/schema.prisma` (or equivalent ORM config) | Organization, Kitchen, User schema + initial migration |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `PRD.md`, `requirement.md` | Source-of-truth docs — Supervisor-owned |
| `memory/*.md` | Supervisor-write-only |

---

## Test Plan

Automated NestJS e2e/unit tests for signup/login (happy path + the 3 negative cases above). Manual verification: run `docker compose up`, hit signup/login via curl or a REST client, confirm DB rows via psql.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run — **pending, Stage 4 (Supervisor/reviewer)**
- [ ] Security review: `Skill({ skill: "security-review" })` run (Medium risk) — **pending, Stage 4 (Supervisor/reviewer)**
- [x] Lint passes (`apps/api` eslint, `apps/web` oxlint)
- [x] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [x] `verify`-equivalent manual check run — feature confirmed working in running app (curl against live `start:dev` server); **full `Skill({ skill: "verify" })` invocation is reserved for Stage 5 per the pipeline**
- [ ] `memory/MEMORY.md` updated (ORM choice decision recorded) — **Supervisor-write-only; ORM decision documented above in Approach section for Supervisor to transcribe**
- [x] Supervisor notified: task ready for Stage 4 review (see final report)
