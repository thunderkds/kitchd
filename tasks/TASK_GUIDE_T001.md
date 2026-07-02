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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to the change's blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — pure backend/infra task | |
| UI: Design-system compliance | ☐ N/A — pure backend/infra task | |
| UI: Responsiveness | ☐ N/A — pure backend/infra task | |

---

## Approach

Per `BRAINSTORMING_LOG.md` (Option B, approved): monorepo with `/apps/web` (React+TS+Vite+Tailwind), `/apps/api` (NestJS), `/packages/shared` (shared TS types/DTOs). Local PostgreSQL via Docker Compose. ORM: Prisma is recommended for NestJS-idiomatic migrations and type generation — confirm this choice explicitly in the task's implementation notes before locking it in (per Stage 1 checklist item 6, ORM was deferred to this task). Initial migrations cover Organization, Kitchen, User only, each with `org_id`/`kitchen_id` scoping per NFR-003. JWT signing via a standard NestJS JWT module; no RolesGuard yet — that's T002's job, so do not add permission checks here beyond "is authenticated."

**Dev server port**: configure Vite (`/apps/web`) to run on `localhost:8766` (set `server.port: 8766` in `vite.config.ts`). This is a fixed convention per `PROJECT_SPEC.md` Critical Constraints — every later FE task's UI Evidence capture (Playwright MCP) targets this exact port. Do not use Vite's default port.

---

## Edge Case Checklist

- [ ] Duplicate email signup is rejected without leaving a partial Organization/Kitchen/User row (transactional)
- [ ] Empty/malformed JWT on any route that requires auth returns 401, not a 500
- [ ] DB migration run twice is idempotent (no error, no duplicate schema objects)
- [ ] API starting before Docker Compose Postgres is ready — retries/backs off instead of crashing

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

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run (Medium risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app
- [ ] `memory/MEMORY.md` updated (ORM choice decision recorded)
- [ ] Supervisor notified: task ready for Stage 4 review
