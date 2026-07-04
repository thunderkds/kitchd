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

### 2026-07-03 — RolesGuard: DB-current role, never JWT claim; 404-not-403 on cross-tenant access
**Decision**: `RolesGuard` (the single RBAC enforcement point, T002) re-reads the caller's role from Postgres on every guarded request rather than trusting a JWT claim (the JWT payload deliberately carries no `role` field). Cross-tenant resource access (e.g. `GET/PATCH /kitchens/:id` for a kitchen the caller doesn't belong to) returns 404, never 403, to avoid leaking the existence of other orgs' data.
**Why**: A role change or removal must take effect on the very next guarded call, not just after re-login (stale-JWT privilege risk). A P0 finding in Stage 4 review caught the initial version trusting `:id` from the URL without scoping to the caller's own kitchen — fixed by deriving `kitchenId` from the caller's own user record, matching `UsersService.invite`'s existing pattern.
**Files**: `apps/api/src/auth/guards/roles.guard.ts`, `apps/api/src/kitchens/kitchens.controller.ts`, `apps/api/src/kitchens/kitchens.service.ts`

### 2026-07-03 — Invite tokens expire after 7 days
**Decision**: `Invite.expiresAt` (nullable, additive migration) is set 7 days out on create/refresh; `acceptInvite` treats an expired PENDING invite the same as not-found (404), never distinguishing "expired" from "invalid" in the response.
**Why**: Stage 4 review flagged that invites never expiring left old/leaked tokens valid indefinitely. 7 days chosen as a reasonable default for MVP; no explicit user requirement drove the exact duration — revisit if a shorter/configurable window is needed later.
**Files**: `apps/api/prisma/migrations/20260703120000_add_invite_expires_at/migration.sql`, `apps/api/src/users/users.service.ts`

### 2026-07-03 — StockMovement is a pure append-only ledger, no cached running balance
**Decision**: `StockMovement` rows are insert-only (no PATCH/DELETE route exists at all); `Ingredient`/`StockBatch` carry no cached quantity column that CONSUME/WASTE/ADJUST movements decrement. Current stock level, if ever needed, is derived by summing movements, not maintained as mutable state.
**Why**: Avoids any read-modify-write race on concurrent stock writes — inserts naturally can't lose an update, whereas a cached balance would need locking or optimistic-concurrency handling. Deduction-on-task-completion (T011) and low-stock alerting (T007) are explicitly out of scope for T004 and will consume this ledger, not extend it with a balance column.
**Files**: `apps/api/src/inventory/inventory.service.ts`, `apps/api/src/inventory/inventory.controller.ts`, `apps/api/prisma/schema.prisma`

### 2026-07-03 — Recipe cost_computed is always live-derived, never stored; versioning via a separate append-only RecipeVersion table
**Decision**: `Recipe`/`RecipeIngredient` store no cost field at all — `cost_computed` is recalculated on every read and write from the CURRENT `Ingredient.cost_per_unit` (T004's module). Version history uses a dedicated `RecipeVersion` table (full snapshot per edit: name/steps/servings/ingredients + the cost as computed at that save time) rather than inline JSON on `Recipe`, with no PATCH/DELETE route — matching T004's `StockMovement` append-only pattern. `Recipe.version` is a plain incrementing int bumped on every create/update, written inside the same `$transaction` as the Recipe/RecipeIngredient rows so a partial failure can't leave version history out of sync.
**Why**: The live-cost behavior is an explicit MVP directive in `TASK_GUIDE_T005.md`/`PROJECT_SPEC.md` (a Recipe's displayed cost should reflect today's ingredient prices, not a stale snapshot from creation time) — confirmed by Stage 5 verify: changing an Ingredient's price after Recipe creation immediately changes the Recipe's `costComputed` on next read, no recipe edit needed. The separate `RecipeVersion` table (vs. inline JSON) was chosen by the implementer to reuse the repo's established append-only-ledger shape and let prior versions be queried directly without ever mutating history rows.
**Files**: `apps/api/src/recipes/recipes.service.ts`, `apps/api/src/recipes/recipes.controller.ts`, `apps/api/prisma/schema.prisma`

### 2026-07-03 — RecipeIngredient → Ingredient FK is onDelete: Restrict
**Decision**: `recipe_ingredients.ingredient_id` references `ingredients.id` with `ON DELETE RESTRICT` — deleting an Ingredient referenced by any RecipeIngredient is blocked at the DB level.
**Why**: T004's Inventory module has no Ingredient-delete endpoint at all yet, so this constraint is currently inert in practice, but it's the simpler, safer default that prevents silent orphaning (a Recipe pointing at a nonexistent Ingredient) if a delete endpoint is ever added — chosen over the alternative of showing "ingredient no longer available" in the API response, which the TASK_GUIDE's edge-case checklist left as an open choice.
**Files**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260703104034_add_recipes/migration.sql`

### 2026-07-04 — Task.sourceGuidelineId is a dedicated column, symmetric with sourceRecipeId, not a shared/overloaded field
**Decision**: T009 added `Task.sourceGuidelineId` (nullable, no FK, `@map("source_guideline_id")`) as its own column rather than reusing `sourceRecipeId` loosely for both source types (e.g. via a discriminator) or adding a polymorphic `sourceType`/`sourceId` pair.
**Why**: `sourceRecipeId` (added inert in T008) already exists with the same shape — plain nullable string, no FK constraint, informational back-reference only. Adding a second column of the identical shape keeps both fields self-describing (`sourceRecipeId` is always a Recipe id or null, `sourceGuidelineId` is always a Guideline id or null) without needing a discriminator column or runtime type-checking on read. The corrected fact: `sourceRecipeId` has never had an FK constraint (an earlier memory entry incorrectly described it as "FK with onDelete SetNull" — verified directly against `20260704081952_add_tasks/migration.sql`, which shows it as a plain column). Additive migration (`20260704120000_add_task_source_guideline_id`), fully reversible via `DROP COLUMN`.
**Files**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260704120000_add_task_source_guideline_id/migration.sql`, `apps/api/src/tasks/generate-from-recipe/generate-task.service.ts`

## Infrastructure
