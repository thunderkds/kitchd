# BRAINSTORMING_LOG.md
**Generated**: 2026-07-02
**Task / Context**: Phase 0 — KitchenOS MVP, Stage 0.5b greenfield architecture direction
**Skill**: `Skill({ skill: "brainstorming" })`

---

## The Problem Space

KitchenOS's MVP spans ~10 interrelated entities (Org, Kitchen, User, Recipe, Ingredient, StockBatch/Movement, Guideline, Task, Note, Announcement, ShiftLog, Comment) with RBAC across 4 roles, cost roll-up logic, recurring task generation, and near-real-time collaboration (comments, task status, mentions). It's a solo build, greenfield repo, local-dev-only for now, but the data model must be multi-tenant-correct from day one per NFR-003. The core tension: enough structure to keep a ~10-entity RBAC-heavy domain consistent as a solo dev, without over-engineering for a userbase of one.

---

## Questions for the User

All four resolved via forced choice before this doc was written:
1. Repo layout → **Monorepo**
2. Backend framework → **NestJS**
3. Realtime mechanism → **Socket.IO from the start**
4. Task recurrence model → **Cron-based generation**

---

## Alternative Paths

| Option | Name | Summary | Invasiveness | Code Volume | Regression Risk | Recommended? |
|--------|------|---------|-------------|------------|----------------|--------------|
| A | The Minimalist Path | Express + polling + single-package repo, virtual recurrence | Low | ~Low | Low (few moving parts) but high rework risk later | |
| B | The Structured Path | NestJS + monorepo + Socket.IO + cron-based recurrence | Medium | ~Medium | Medium, offset by framework guardrails | ✅ Yes |
| C | The Maximalist Path | NestJS microservices (separate auth/inventory/task services) + message queue + Socket.IO | High | High | High — massive overkill for solo/local MVP | |

### Option A — The Minimalist Path
**Approach**: Express, single package (no monorepo split), polling instead of WebSockets, recurrence computed virtually at read time.
**Pros**: Fastest to first running screen; fewest dependencies; nothing to configure.
**Cons**: RBAC guards, validation, and module boundaries must be hand-rolled per route — high risk of inconsistency across 10 entities; virtual recurrence complicates "did staff complete today's occurrence" state and stock-deduction-per-occurrence.
**Why it might fail**: As Task/Comment/Notification routes multiply, hand-rolled auth checks silently diverge (one route forgets a role check) — exactly the kind of bug that's invisible until a Staff user edits a Guideline they shouldn't be able to touch.

### Option B — The Structured Path
**Approach**: NestJS backend (modules/guards/DI mapping directly onto Organization→Kitchen→User RBAC), React frontend, monorepo (`/apps/web`, `/apps/api`, `/packages/shared` for shared TS types), Socket.IO for Task/Comment/Announcement push updates, a nightly cron job materializing real Task rows from recurring Task templates.
**Pros**: NestJS guards give one consistent enforcement point for the 4-role RBAC model instead of 10+ hand-rolled checks; monorepo keeps API contract types shared and in sync for a solo dev; Socket.IO ships real-time UX correctly from day one instead of a polling-to-WebSocket migration later; cron-generated Tasks are real rows — completion, per-occurrence stock deduction (FR-008's confirm-prompt), and querying "today's tasks" all stay simple.
**Cons**: More upfront boilerplate than Express; Socket.IO needs auth-over-WS handling even with a single user; cron job is one more moving part to run locally (needs a scheduler, e.g. `@nestjs/schedule`).
**Why it might fail**: If the solo dev under-invests in the NestJS module boundaries early (dumping everything in one module), the framework's structure stops paying for itself and just adds ceremony. Mitigation: TASK_GUIDEs enforce one NestJS module per entity domain (recipes, inventory, tasks, notes, comms) from the first task.

### Option C — The Maximalist Path
**Approach**: NestJS microservices split by domain (auth-service, inventory-service, task-service), message queue (RabbitMQ/Kafka) for cross-service events, Socket.IO gateway service, API gateway.
**Pros**: Scales to real multi-tenant SaaS traffic; services deployable/scalable independently.
**Cons**: Massive operational overhead (service discovery, distributed transactions for stock-deduction-on-task-completion, local dev requires running N services) for a single-user local-dev MVP.
**Why it might fail**: A solo dev spends Phase 0-2 wiring infrastructure instead of shipping the recipe/task/inventory features that are the actual point of the MVP — directly violates Simplicity First.

---

## 50% Rule Check

For Option B: the biggest line-count driver is RBAC guard boilerplate across ~10 entities. Instead of a bespoke guard per controller, use one generic `@Roles(...)` decorator + a single `RolesGuard` reading `req.user.role` — implemented once in Common-Infrastructure-Agent's task, reused everywhere. Similarly, Socket.IO auth reuses the same JWT verification middleware as the REST layer rather than a parallel WS-auth implementation. This keeps Option B's boilerplate closer to Option A's volume while keeping its consistency guarantees.

---

## Recommended Path

**Option B — The Structured Path**

Matches the domain's actual shape (RBAC-heavy, ~10 entities, real-time collaboration is a named MVP requirement in §3.3) without paying for Option C's distributed-systems overhead that no current requirement calls for. The confirmed user answers (NestJS, monorepo, Socket.IO, cron recurrence) already point here — this doc formalizes why that combination coheres rather than being four independent picks.

---

## Surgical Scope

Files that **should** be touched (Stage 1 scaffold, Stage 3 onward):
- `/apps/api` — NestJS backend, one module per domain entity group
- `/apps/web` — React + TypeScript frontend
- `/packages/shared` — shared TypeScript types (DTOs, enums) between web and api
- `/apps/api/prisma` or `/apps/api/migrations` — DB schema (framework choice: TBD at Stage 1 scaffold, Prisma or TypeORM — NestJS-idiomatic either way)

Files that **must not** be touched:
- `requirement.md`, `PRD.md` — source-of-truth docs; changes go through the Supervisor, not implementers
- `memory/` cold files — Supervisor-only writes per Memory Write Protocol

---

## Edge Case Checklist for TASK_GUIDE

- [ ] Concurrent stock deduction: two staff completing recipe-linked tasks for the same ingredient at nearly the same time — must not race past min_threshold silently
- [ ] Recurring task cron job failing silently overnight — no "today's tasks" for staff in the morning
- [ ] @mention parsing on a user who isn't a member of that Kitchen (cross-kitchen mention)
- [ ] Socket.IO reconnect after a dropped connection — must not duplicate task/comment events on reconnect
- [ ] Role downgrade mid-session (Admin demotes a Chef to Staff) — existing WS connection must respect the new role, not the cached one
- [ ] Recipe cost roll-up when an underlying Ingredient's cost_per_unit changes after the Recipe was created — historical cost vs live cost distinction
- [ ] Expiry-date StockBatch with a past date at time of stock receipt entry (data-entry error)
- [ ] CSV export with embedded commas/newlines in Recipe steps or Note bodies

---

## Next Actions

1. Stage 1: scaffold monorepo (`/apps/web`, `/apps/api`, `/packages/shared`), confirm ORM choice (Prisma vs TypeORM) with user during Common-Infrastructure-Agent setup
2. Stage 1: set up `RolesGuard` + `@Roles()` decorator pattern once, reused across all entity modules
3. Stage 2: break MVP into tracer-bullet vertical slices via `to-issues`, ordered per requirement.md §9 phases (Foundation → Guidelines/Inventory → Tasks/Notes → Communication → Dashboard/Roles/Polish)
4. Stage 2: each Task-domain slice must reference the Edge Case Checklist above in its TASK_GUIDE

---

## User Selection

> **Approved direction**: Option B — The Structured Path
> Approved by user on 2026-07-02 (via forced-choice answers: NestJS, monorepo, Socket.IO, cron recurrence).
