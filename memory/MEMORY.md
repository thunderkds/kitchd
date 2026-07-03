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
