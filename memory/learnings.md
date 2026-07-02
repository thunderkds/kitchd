# learnings.md — Cold Tier: Clarifications, Patterns & Gotchas

> **Rules**: Supervisor-only writes. Each entry dated (`YYYY-MM-DD`) and citing the file/task it came from (the diff-driven pass greps this file by changed file path).

## Requirement Clarifications

## Patterns

## Gotchas

### 2026-07-02 — CLAUDE.md, templates/, .claude/agents|hooks|skills are symlinks to ~/.supervisor/
This repo's `CLAUDE.md`, `templates/`, `.claude/agents/`, `.claude/hooks/`, `.claude/skills/` are all symlinks pointing to `/home/hungnguyenhuu/.supervisor/...` (a local, machine-specific path outside the repo). They must be excluded from git commits (`git add` them individually will fail portability for any other clone) — only `.claude/settings.json` and `.claude/settings.local.json` are real files in `.claude/`. First hit: initial `feat/kitchenos-planning` branch push (commit 1fef6ea), had to `git restore --staged` the symlinked paths after an initial `git add .claude/`.
