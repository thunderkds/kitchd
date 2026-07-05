# MEMORY.md — Hot-Tier Memory Index

> **Rules**: Supervisor-only writes. Max 200 lines. One-line summaries + links to cold files.
> Injected in full into every sub-agent spawn prompt.
> Updated by the Supervisor — prompted by the PostToolUse hook on `git push` / `git merge` (diff-driven pass), or via the `/compact-memory` skill.

---

## Memory Architecture

- [decisions.md](decisions.md) — code + infra architectural decisions (the "why")
- [glossary.md](glossary.md) — canonical biz domain terms and core domain models
- [learnings.md](learnings.md) — specs/requirement clarifications, patterns, gotchas

---

## Index

<!-- Format: - [Title](cold-file.md#section) — one-line summary (≤150 chars) -->
- [Monorepo, NestJS, Socket.IO, cron recurrence](decisions.md#2026-07-02--monorepo-nestjs-backend-socketio-realtime-cron-based-recurrence) — locked architecture direction for KitchenOS MVP, see BRAINSTORMING_LOG.md
- [Multi-tenant data model from day one](decisions.md#2026-07-02--multi-tenant-data-model-from-day-one) — org_id/kitchen_id scoping on every entity even though MVP is single-org/single-kitchen
- [KitchenOS Domain Models](glossary.md#domain-models) — 14 confirmed entities: Organization, Kitchen, User, Recipe, RecipeIngredient, Ingredient, StockBatch, StockMovement, Guideline, Task, Note, Announcement, ShiftLog, Comment
- [Web dev server fixed at localhost:8766](decisions.md#2026-07-02--web-dev-server-fixed-at-localhost8766-for-ui-verify-mcp-evidence-capture) — `easy-ui-mcp` targets this port for all FE UI Evidence capture
- [Symlinked CLAUDE.md/templates/.claude subfolders](learnings.md#2026-07-02--claudemd-templates-claudeagentshoootsskills-are-symlinks-to-supervisor) — exclude from git commits, only `.claude/settings*.json` are real files
- Planning artifacts (PRD, spec, kanban, 22 task guides) pushed to `feat/kitchenos-planning` branch, commit 1fef6ea — merged into develop
- [CI/CD added: staging-only Railway deploy](decisions.md#2026-07-02--cicd-added-staging-only-auto-deploy-to-railway-never-main) — T023 added post-hoc; CI on all push/PR, CD only on merge to `staging`, never `main`
- [easy-ui-mcp needs `network_mode: host`](decisions.md#2026-07-03--easy-ui-mcp-requires-network_mode-host-to-reach-app-dev-servers) — default bridge network had zero route to host; fixed in sibling easy-ui-mcp repo's docker-compose.yml
- [ORM confirmed: Prisma](decisions.md#2026-07-02--orm-confirmed-prisma) — declarative schema, transactional signup, migrate deploy for CI/CD
- [Stale untracked `.env` can drift silently](learnings.md#2026-07-03--local-untracked-env-can-silently-drift-from-envexample) — apps/web/.env pointed at wrong API port; check against .env.example when UI fetch fails
- [Archive external-tool evidence into repo](learnings.md#2026-07-03--archive-external-tool-evidence-screenshots-session-reports-into-this-repo) — copy easy-ui-mcp screenshots/reports into `reports/evidence/<TASK_ID>/` and commit
- **T001 Done** (2026-07-03) — monorepo scaffold + auth skeleton merged to develop (commit `f61eb03`), pushed to origin. Code-review, security-review, and Stage 5 verify (API + real browser UI) all passed.
- [RolesGuard: DB-current role, 404-not-403 cross-tenant](decisions.md#2026-07-03--rolesguard-db-current-role-never-jwt-claim-404-not-403-on-cross-tenant-access) — reference pattern for all future kitchen-scoped routes (T004+)
- [Invite tokens expire after 7 days](decisions.md#2026-07-03--invite-tokens-expire-after-7-days) — Invite.expiresAt, additive migration
- [Kitchen-scoped controller pattern](learnings.md#2026-07-03--kitchen-scoped-controller-pattern-derive-callers-kitchenid-server-side-never-trust-id) — derive caller's own scope server-side, never trust `:id`; reuse for T004+
- [TASK_GUIDE verification commands can be stale](learnings.md#2026-07-03--task_guides-stated-verification-command-can-be-stalewrong--always-run-it-dont-just-trust-it) — always actually run it at review time
- [Evidence Gate hook checks root tasks/, requires "pass" in 3rd cell](learnings.md#2026-07-03--evidence-gate-hook-pre_bash_block_unsafe_mergepy-checks-the-root-tasks-dir-not-worktree-copies-and-requires-pass-in-the-third-cell) — copy finished guide to root before merge; `| verify | ☒ pass | ...pass/PASS somewhere in Notes... |`
- **T002 Done** (2026-07-03) — RBAC guard + invite flow merged to develop (commit `424cee9`). 1 P0 fixed (cross-tenant IDOR), code-review/migration-safety/security-review/verify all passed.
- **T003 Done** (2026-07-03) — base app shell merged to develop (commit `2f30dc5`). Code-review (0 P0/P1) and verify passed.
- [Append-only audit-ledger pattern](learnings.md#2026-07-03--append-only-audit-ledger-pattern-no-patchdelete-route-no-cached-running-balance) — no PATCH/DELETE route (not app-level rejection) + no cached derived-state column; reuse for ShiftLog/T014, Comment edit history/T015
- **T004 Done** (2026-07-03) — Ingredient CRUD + StockBatch/StockMovement ledger merged to develop (commit `a6dba49`). Code-review (0 findings), migration-safety (GO, additive), security-review (clean), verify (live probes) all passed. 45/45 tests green post-merge.
- [Recipe cost_computed live-derived, RecipeVersion append-only table](decisions.md#2026-07-03--recipe-cost_computed-is-always-live-derived-never-stored-versioning-via-a-separate-append-only-recipeversion-table) — never cached, recomputed every read/write from live Ingredient.cost_per_unit
- [RecipeIngredient→Ingredient FK onDelete: Restrict](decisions.md#2026-07-03--recipeingredient--ingredient-fk-is-ondelete-restrict) — safe default, inert today since Ingredient has no delete endpoint yet
- [Archive verify sessions applies to backend curl sessions too, not just UI screenshots](learnings.md#2026-07-03--archive-external-tool-evidence-screenshots-session-reports-into-this-repo) — a terminal session isn't evidence until written to reports/evidence/<TASK_ID>/ and committed
- [Agent isolation:"worktree" conflicts with a pre-created Supervisor worktree](learnings.md#2026-07-03--agent-tools-isolation-worktree-conflicts-with-a-supervisor-pre-created-worktree) — omit `isolation` when a worktree already exists for the task; agent correctly stopped and asked rather than guessing
- **T005 Done** (2026-07-03) — Recipe CRUD + auto cost roll-up merged to develop (commit `9e3c1b8`). Code-review (0 P0/P1, 2 P2/1 P3 advisory), migration-safety (GO, additive), security-review (clean), verify (all 4 ACs + 3 probes) all passed. 53/53 tests green post-merge.
- **T008 Done** (2026-07-04) — Task CRUD + kanban/list toggle merged to develop (commit `223e5de`). Code-review (0 P0/P1, 2 P2/1 P3 advisory), security-review (clean), live API+browser verify (AC1-5 + cross-tenant 404 + staff-reassign-403 probes) all passed. 61/61 backend + 19/19 frontend tests green post-merge.
- [STAFF field-allowlist doesn't scope field content](learnings.md#2026-07-04--field-name-allowlist-for-restricted-role-patch-doesnt-scope-field-content) — allowing a field name (e.g. checklistItems) lets the caller replace its entire content, not just the intended sub-change; diff vs existing if narrower scope is intended
- [easy-ui-mcp has no select/viewport primitives](learnings.md#2026-07-04--easy-ui-mcp-toolset-has-no-viewport-resize-primitive) — use direct URL nav for select-driven state, `ui_assert` DOM checks for responsive breakpoints
- **Process fix (2026-07-04)**: all not-yet-started TASK_GUIDEs (T006/T007/T009-T023) + master template hardened with bare `| verify |` label + explicit "Evidence is required" reminder, after T008 nearly shipped without a filled Evidence table (caught by user, not process)
- [T009 blocked on T006 — Guideline model doesn't exist yet](learnings.md#2026-07-04--t009-depends-on-the-guideline-model-which-t006-not-t009-is-responsible-for-building) — task numbering isn't a reliable dependency graph; verify referenced modules actually exist before starting
- **T006 Done** (2026-07-04) — Guideline CRUD merged to develop (commit pending push). Code-review caught a live 500-vs-400 bug (invalid `?type=` enum filter) during Stage 5 verify, fixed same-session with a regression test, re-verified live. 67/67 tests green post-merge. Unblocks T009.
- [Enum query-param filters need explicit validation](learnings.md#2026-07-04--enum-query-param-filters-need-explicit-validation-or-prisma-throws-an-unhandled-500) — `@Query()` string params bypass DTO `@IsEnum` checks; validate manually or Prisma throws an unhandled 500 on garbage input
- **T009 Done** (2026-07-04) — Generate Task from Recipe/Guideline merged to develop (commit pending push). Code-review clean (0 findings), live verify confirmed both source paths + version-drift snapshot edge case + 3 negative probes. 72/72 tests green post-merge.
- [Task.sourceGuidelineId: dedicated column, symmetric with sourceRecipeId](decisions.md#2026-07-04--tasksourceguidelineid-is-a-dedicated-column-symmetric-with-sourcerecipeid-not-a-sharedoverloaded-field) — plain nullable column, no FK, mutually exclusive with sourceRecipeId depending on generation source
- **T011 Done** (2026-07-05) — Stock deduction on recipe-linked task completion merged to develop (commit `d406513` on top of `8b39e04`). Code-review (0 P0/P1), security-review (0 HIGH/MEDIUM), live API+browser verify (preview/confirm/negative-stock/double-completion-409/decline-unchanged) all passed. 83/83 backend + 24/24 frontend tests green.
- [T011 RBAC bypass + negative-stock + atomic double-completion claim](decisions.md#2026-07-05--t011-stock-deduction-rbac-bypass-is-intentional-negative-stock-allowedflagged-atomic-claim-guards-double-completion) — STAFF can trigger deduction via own-task completion without inventory-write RBAC; negative stock allowed+flagged not blocked; same-task double-confirm guarded by atomic conditional `updateMany`, not serializable tx
- [StockMovement derived-balance read now implemented](decisions.md#2026-07-03--stockmovement-is-a-pure-append-only-ledger-no-cached-running-balance) — `InventoryService#currentStock` sums the ledger on every call (T011), still no cached column
- [easy-ui-mcp responsive-breakpoint workaround: DOM assertion, not resize screenshot](learnings.md#the-mcp-tool-list) — no viewport-resize primitive; assert CSS classes / `getBoundingClientRect()` against the live DOM instead
