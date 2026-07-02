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
- [Web dev server fixed at localhost:8765](decisions.md#2026-07-02--web-dev-server-fixed-at-localhost8765-for-playwright-mcp-evidence-capture) — Playwright MCP targets this port for all FE UI Evidence capture
- [Symlinked CLAUDE.md/templates/.claude subfolders](learnings.md#2026-07-02--claudemd-templates-claudeagentshoootsskills-are-symlinks-to-supervisor) — exclude from git commits, only `.claude/settings*.json` are real files
- Planning artifacts (PRD, spec, kanban, 22 task guides) pushed to `feat/kitchenos-planning` branch, commit 1fef6ea — merged into develop
- [CI/CD added: staging-only Railway deploy](decisions.md#2026-07-02--cicd-added-staging-only-auto-deploy-to-railway-never-main) — T023 added post-hoc; CI on all push/PR, CD only on merge to `staging`, never `main`
