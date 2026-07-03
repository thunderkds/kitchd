# decisions.md — Cold Tier: Architectural & Infrastructure Decisions

> **Rules**: Supervisor-only writes. Each entry: `### YYYY-MM-DD — Title`, then **Decision**, **Why**, and **Files** (cite paths — the diff-driven pass greps this file by changed file path).

## Architecture

### 2026-07-02 — Monorepo, NestJS backend, Socket.IO realtime, cron-based recurrence
**Decision**: KitchenOS MVP is a monorepo (`/apps/web` React+TS, `/apps/api` NestJS, `/packages/shared` shared DTO/types) with PostgreSQL, custom JWT auth (org/role model), Socket.IO for realtime Task/Comment/Announcement updates, and a nightly cron job materializing recurring Task rows (not virtual/on-the-fly recurrence instances).
**Why**: Domain is RBAC-heavy (~10 entities, 4 roles) — NestJS guards/DI give one consistent enforcement point instead of hand-rolled per-route checks. Monorepo keeps API types in sync for a solo dev. Socket.IO ships correct realtime UX from day one (named MVP requirement, PRD §3.3/NFR-002) instead of a later polling-to-WS migration. Cron-generated Task rows keep per-occurrence completion and stock-deduction-on-completion (FR-008) simple to model. Full comparison in `BRAINSTORMING_LOG.md` (Option B selected over Minimalist/Express+polling and Maximalist/microservices paths).
**Files**: `/apps/api/**`, `/apps/web/**`, `/packages/shared/**`

### 2026-07-02 — Multi-tenant data model from day one
**Decision**: Every entity's schema includes `org_id`/`kitchen_id` scoping from the first migration, even though MVP usage is a single Organization with a single Kitchen.
**Why**: NFR-003 requires multi-tenant readiness for a possible future SaaS pivot; retrofitting tenant scoping onto ~10 entities after the fact is far more expensive than building it correctly now.
**Files**: `/apps/api/src/**/entities/**` (all domain entities)

### 2026-07-02 — Web dev server fixed at localhost:8766 for UI-verify MCP evidence capture
**Decision**: `/apps/web`'s Vite dev server runs on a fixed port `8766` (not Vite's default), and all FE TASK_GUIDEs' UI Evidence rows (visual regression, design-system compliance, responsiveness) use the `easy-ui-mcp` tool (Playwright-backed, exposed as `mcp__easy-ui-mcp__*` tools) against `localhost:8766`.
**Why**: Hard-Stop Gate 6 requires pasted evidence for every UI task's design-acceptance rows; a fixed, known port lets the MCP browser reliably navigate to the running app without per-task port discovery. User confirmed this port explicitly.
**Files**: `/apps/web/vite.config.ts`, `tasks/TASK_GUIDE_T001.md`, `tasks/TASK_GUIDE_T003.md`, `T007`, `T008`, `T011`, `T012`, `T015`, `T016`, `T018`, `T021`

### 2026-07-03 — easy-ui-mcp requires `network_mode: host` to reach app dev servers
**Decision**: The `easy-ui-mcp` server (a sibling repo/container at `/home/hungnguyenhuu/workspace/pets/hungnguyen111/easy-ui-mcp`, providing the `mcp__easy-ui-mcp__*` browser tools) must run with `network_mode: host` in its `docker-compose.yml`, not a default bridge network with a published port.
**Why**: The default bridge-network container had no route to this host's `localhost`/LAN IP at all (confirmed: `ERR_CONNECTION_REFUSED` on `localhost:8766`, 15s timeout on the LAN IP even with the target dev server bound to `0.0.0.0`) — this blocked T001's Stage 5 UI verification entirely until fixed. `network_mode: host` was chosen over `extra_hosts: host-gateway` for simplicity (single-host local dev, no need for port publishing).
**Files**: `/home/hungnguyenhuu/workspace/pets/hungnguyen111/easy-ui-mcp/docker-compose.yml`

### 2026-07-02 — ORM confirmed: Prisma
**Decision**: `/apps/api` uses Prisma (declarative `schema.prisma`, generated type-safe client, `prisma migrate dev`/`deploy`) as the ORM/migration tool, as recommended in T001's TASK_GUIDE and confirmed during implementation.
**Why**: First-class NestJS ecosystem support, readable migration diffs, `migrate deploy` cleanly separates dev-time vs deploy-time flows (needed by the `migrate` script used in verification and CI/CD), and `$transaction` made the transactional signup (Organization+Kitchen+User, all-or-nothing) straightforward. No alternative was seriously evaluated — no material downside at this MVP's scale.
**Files**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`

### 2026-07-02 — CI/CD added: staging-only auto-deploy to Railway, never main
**Decision**: T023 adds a GitHub Actions CI workflow (lint/typecheck/test/build on every push+PR) and a separate CD workflow that deploys to Railway staging ONLY on merge to the `staging` branch. No workflow deploys on `main` pushes — production deployment remains explicitly out of scope for this milestone.
**Why**: User flagged the missing CI/CD task after Stage 2 planning was already committed; this reopened (partially) the earlier "local dev only" hosting decision. Resolved via forced choice: CI+CD scope confirmed, staging host confirmed as Railway, deploy trigger confirmed as `staging` branch only (not `main`) to keep the earlier production-deferral decision intact.
**Files**: `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `tasks/TASK_GUIDE_T023.md`

## Infrastructure
