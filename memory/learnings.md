# learnings.md — Cold Tier: Clarifications, Patterns & Gotchas

> **Rules**: Supervisor-only writes. Each entry dated (`YYYY-MM-DD`) and citing the file/task it came from (the diff-driven pass greps this file by changed file path).

## Requirement Clarifications

## Patterns

## Gotchas

### 2026-07-03 — Local untracked `.env` can silently drift from `.env.example`
`apps/web/.env` is gitignored (untracked) and had `VITE_API_BASE_URL=http://localhost:3001` while the API's own `apps/api/.env` (`PORT=3000`) and the committed `apps/web/.env.example` both correctly say `3000`. This caused a real "Failed to fetch" error during T001's Stage 5 UI signup walkthrough — not a code bug, just local env drift. Fixed by editing the untracked `.env` directly (nothing to commit). When a UI flow fails with a network/fetch error, check the untracked `.env` against `.env.example`/the API's actual configured port before assuming an app bug.
**Files**: `apps/web/.env`, `apps/web/.env.example`, `apps/api/.env`

### 2026-07-03 — Archive external-tool evidence (screenshots, session reports) into this repo
`easy-ui-mcp` writes screenshots/session reports to its own repo's `reports/` dir by default (mounted volume), not this repo's. For durable Stage 5 UI-verify evidence, copy the relevant files into `kitchd/reports/evidence/<TASK_ID>/` and commit them — external tool output isn't guaranteed to persist or stay linkable. Done for T001: `reports/evidence/T001/*.png`, `*.json`, `*.html`.
**Files**: `reports/evidence/T001/**`, `tasks/TASK_GUIDE_T001.md`

### 2026-07-02 — CLAUDE.md, templates/, .claude/agents|hooks|skills are symlinks to ~/.supervisor/
This repo's `CLAUDE.md`, `templates/`, `.claude/agents/`, `.claude/hooks/`, `.claude/skills/` are all symlinks pointing to `/home/hungnguyenhuu/.supervisor/...` (a local, machine-specific path outside the repo). They must be excluded from git commits (`git add` them individually will fail portability for any other clone) — only `.claude/settings.json` and `.claude/settings.local.json` are real files in `.claude/`. First hit: initial `feat/kitchenos-planning` branch push (commit 1fef6ea), had to `git restore --staged` the symlinked paths after an initial `git add .claude/`.
