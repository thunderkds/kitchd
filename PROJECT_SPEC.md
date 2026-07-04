# PROJECT_SPEC.md
**Last updated**: 2026-07-02
**Version**: 1.0

> **Scope of this document**: *How* to build it safely — architecture, agent config, constraints, risk areas, task state, and accumulated learnings.
> Product intent (personas, user stories, FR/NFR, success metrics) lives in `PRD.md`.
> If Critical Constraints here conflict with Out of Scope in `PRD.md`, resolve before Stage 2.

---

## Project Identity

- **Name**: KitchenOS
- **Repo**: /home/hungnguyenhuu/workspace/pets/hungnguyen111/kitchd (local, branch `develop`)
- **Primary tech**: TypeScript — React (frontend), NestJS (backend), PostgreSQL
- **Type**: Web app (monorepo: `/apps/web`, `/apps/api`, `/packages/shared`)
- **Deployment target**: Local dev (primary) + Railway staging (auto-deploy on merge to `staging` branch). Production/`main` deploy deferred.
- **Key stakeholders**: Solo founder (hungnh1110@gmail.com) — self-use first, startup-idea framing for the future

---

## Architecture Summary

KitchenOS is a monorepo with a NestJS backend (`/apps/api`) organized into one module per domain entity group (recipes, inventory, tasks, notes, communications), a React + TypeScript frontend (`/apps/web`), and shared DTO/type definitions in `/packages/shared`. PostgreSQL is the datastore; auth is custom JWT with an Organization → Kitchen → User role model (Owner/Admin, Chef, Staff, Viewer) enforced via a single reusable `RolesGuard` + `@Roles()` decorator. Realtime updates (tasks, comments, announcements) go over Socket.IO, authenticated with the same JWT middleware as REST. Recurring prep tasks are materialized as real rows by a nightly cron job rather than computed virtually.

---

## Critical Constraints

- `requirement.md` and `PRD.md` are source-of-truth product docs — implementers must not edit them; changes route through the Supervisor.
- `memory/` cold files (`decisions.md`, `glossary.md`, `learnings.md`) are Supervisor-write-only — sub-agents never write to memory directly.
- Multi-tenant data model (Organization → Kitchen → User) must be respected in every entity's schema from the first migration, even though MVP usage is single-org/single-kitchen (NFR-003).
- Stock deduction on recipe-linked task completion must show a confirm-before-apply prompt (FR-008) — never silently auto-deduct.
- RBAC must go through the shared `RolesGuard` + `@Roles()` decorator — no ad-hoc per-route permission checks.
- No production (`main`) deployment in this milestone. Staging deploy IS in scope: CD deploys to Railway on merge to the `staging` branch only, never `main`. Local dev (Docker Compose for Postgres) remains the primary dev workflow.
- Web dev server (`/apps/web`) must be exposed at `localhost:8766` — this is the fixed target the Playwright MCP uses for all UI Evidence screenshot capture (visual regression, design-system compliance, responsiveness rows). T001 must configure Vite's dev server port accordingly; do not change this port in later tasks without Supervisor sign-off, since every FE TASK_GUIDE's evidence instructions assume it.

---

## Known Risk Areas

| Area | Risk Level | Reason | Files |
|------|-----------|--------|-------|
| Stock deduction / StockMovement ledger | High | Concurrent task completions could race past min_threshold; financial-adjacent data (cost roll-up) | `/apps/api/src/inventory/**` |
| Auth / RolesGuard | High | Single enforcement point for all RBAC — a bug here compromises every entity's permission model | `/apps/api/src/auth/**` |
| Recurring task cron job | Medium | Silent failure overnight means no "today's tasks" for staff | `/apps/api/src/tasks/recurrence/**` |
| Socket.IO gateway | Medium | Reconnect/duplicate-event and role-downgrade-mid-session edge cases | `/apps/api/src/realtime/**` |
| Recipe cost roll-up | Medium | Historical vs live ingredient cost distinction; silent miscalculation affects US-001 acceptance | `/apps/api/src/recipes/**` |

---

## Sub-Agent Team

| Agent | Role | CLI Spawn Command |
|---|---|---|
| Common-Infrastructure-Agent | Env setup, worktrees, monorepo scaffold, migrations | `Agent({ subagent_type: "common-infrastructure", prompt: "..." })` |
| Backend-Implementer | NestJS modules, RBAC, cost roll-up, cron recurrence | `Agent({ subagent_type: "backend-developer", prompt: "..." })` |
| Frontend-Implementer | React UI (Dashboard, Tasks, Guidelines, Inventory, Notes, Comms) | `Agent({ subagent_type: "frontend-developer", prompt: "..." })` |
| QA-Automation-Agent | Smoke suite, acceptance-criteria verification | `Agent({ subagent_type: "qa-expert", prompt: "..." })` |

---

## Tasks

| ID | Title | Status | Assigned Agent | Complexity | Risk | Priority |
|----|-------|--------|---------------|-----------|------|----------|
| — | *(populated in Stage 2 via `to-issues` → `PROJECT_KANBAN.md`)* | — | — | — | — | — |

---

## Memory / Insights

Running log of key decisions, patterns, and lessons learned across tasks.

| Date | Insight | Source Task |
|------|---------|------------|
| 2026-07-02 | Architecture direction locked: NestJS + monorepo + Socket.IO + cron-based recurrence (Option B, see `BRAINSTORMING_LOG.md`) | Stage 0.5b |
| 2026-07-02 | FR-008 clarified: stock deduction on task completion requires one-tap confirm, not silent auto-deduct | Stage 0.5a (grill-with-docs) |
| 2026-07-04 | Task model added with `recurrenceRule`/`sourceRecipeId` as inert schema placeholders for T009/T010 — CRUD-only PATCH permission split: WRITE_ROLES (OWNER/ADMIN/CHEF) can edit any field on any Task; STAFF/VIEWER may only PATCH `status`/`checklistItems` and only on a Task where `assigneeId === caller.id`, else 403 | T008 |
| 2026-07-04 | Frontend kanban/list toggle shares one fetched Task[] and keeps `view`/`assignee` filter state in URL search params so toggling views never refetches or drops the active filter; tap-to-move buttons (≥44px) are always rendered as the touch fallback alongside native HTML5 drag, not hidden behind touch detection | T008 |
| 2026-07-04 | Guideline model added (kitchen-scoped SOP/checklist docs): `title`, `type` (GuidelineType enum SOP/CHECKLIST), `steps` String[], `attachments` String[] default `[]` (no file-storage backend wired yet — stub for MVP). Deliberately simpler than Recipe: no ingredients/cost, no version history. Same kitchen-scoped-controller + WRITE_ROLES (OWNER/ADMIN/CHEF) pattern as Recipes/Tasks; STAFF/VIEWER read-only, 403 on POST/PATCH. `GET /guidelines?type=` filters by type. This is a genuine blocking prerequisite for T009 (generate Task from Guideline), which reads this model next. | T006 |
| 2026-07-04 | **Design decision needing memory/decisions.md write**: T009 AC3 required picking between reusing `sourceRecipeId` loosely for Guidelines or adding a dedicated `sourceGuidelineId` column — **chose a dedicated `sourceGuidelineId`** (nullable, additive migration `20260704120000_add_task_source_guideline_id`), mirroring the existing `sourceRecipeId` column exactly: plain nullable `TEXT` column, **no FK constraint** (matches the actual T008 migration, which — despite being described in memory as "FK w/ onDelete SetNull" — in reality added `source_recipe_id` as an inert column with no FK; verified by reading `20260704081952_add_tasks/migration.sql`). Rationale: keeping both source columns symmetric (informational back-reference only, not enforced referential integrity) is simpler and avoids a schema inconsistency between the two "generated-from" pointers. A Task generated from a Recipe sets `sourceRecipeId` and leaves `sourceGuidelineId` null, and vice versa — never both. Checklist snapshotting: `GenerateTaskService` (new, `apps/api/src/tasks/generate-from-recipe/generate-task.service.ts`) copies `steps: string[]` into `checklistItems` at generation time via `{id: crypto.randomUUID(), text: step, done: false}` — a one-time copy, not a live reference; verified by an e2e test that PATCHes the source Recipe's `steps` after generation and asserts the already-generated Task's checklist is unchanged. Endpoints: `POST /tasks/generate-from-recipe/recipe/:recipeId` and `POST /tasks/generate-from-recipe/guideline/:guidelineId`, both WRITE_ROLES-gated, both 404 (not 403) on missing/cross-tenant source id via the standard kitchen-scoped-controller pattern. Flag for Supervisor: please record the `sourceGuidelineId` vs. reused-`sourceRecipeId` choice (and the corrected T008 migration fact — no FK exists on `source_recipe_id`) in `memory/decisions.md` at Stage 5. | T009 |
