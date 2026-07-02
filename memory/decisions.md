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

### 2026-07-02 — Web dev server fixed at localhost:8765 for Playwright MCP evidence capture
**Decision**: `/apps/web`'s Vite dev server runs on a fixed port `8765` (not Vite's default), and all FE TASK_GUIDEs' UI Evidence rows (visual regression, design-system compliance, responsiveness) use the Playwright MCP against `localhost:8765`.
**Why**: Hard-Stop Gate 6 requires pasted evidence for every UI task's design-acceptance rows; a fixed, known port lets the Playwright MCP reliably navigate to the running app without per-task port discovery. User confirmed this port explicitly.
**Files**: `/apps/web/vite.config.ts`, `tasks/TASK_GUIDE_T001.md`, `tasks/TASK_GUIDE_T003.md`, `T007`, `T008`, `T011`, `T012`, `T015`, `T016`, `T018`, `T021`

## Infrastructure
