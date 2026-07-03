# learnings.md — Cold Tier: Clarifications, Patterns & Gotchas

> **Rules**: Supervisor-only writes. Each entry dated (`YYYY-MM-DD`) and citing the file/task it came from (the diff-driven pass greps this file by changed file path).

## Requirement Clarifications

## Patterns

### 2026-07-03 — Kitchen-scoped controller pattern: derive caller's kitchenId server-side, never trust `:id`
Any route taking a `:id` URL param for a tenant-scoped resource must resolve the caller's own scope (kitchenId/orgId) from their authenticated user record first, then compare/query against that — never query directly by the untrusted `:id` and treat a 403 as sufficient (it leaks existence). Mismatch → 404. See `KitchensController.callerKitchenId()` (T002) as the reference implementation; reuse this shape for all future kitchen-scoped CRUD (T004+).
**Files**: `apps/api/src/kitchens/kitchens.controller.ts`, `apps/api/src/kitchens/kitchens.service.ts`

## Gotchas

### 2026-07-03 — TASK_GUIDE's stated "Verification Command" can be stale/wrong — always run it, don't just trust it
T003's TASK_GUIDE specified `npm --prefix apps/web run test -- layout routing`, but no test file matched that Vitest filter (actual files: `App.test.tsx`, `AuthGuard.test.tsx`, `LoginPage.test.tsx`) — the command failed with "No test files found" despite the underlying suite being fully green. Caught only by actually running the command at Stage 4/5 review rather than trusting the implementer's report. Corrected in the guide to the full-suite command.
**Files**: `tasks/TASK_GUIDE_T003.md`

### 2026-07-03 — Evidence Gate hook (`pre_bash_block_unsafe_merge.py`) checks the *root* `tasks/` dir, not worktree copies
The PreToolUse hook blocking `git push`/`merge`/`rebase` reads `tasks/TASK_GUIDE_T00X.md` from the main repo's working tree, not from `.claude/worktrees/T00X/tasks/`. Evidence filled only in the worktree copy won't satisfy the gate — copy the finished TASK_GUIDE into the main repo's `tasks/` dir before merging. Also: its regex (`verify\s*\|[^|\n]+\|[^|\n]*pass`) requires the literal word `verify` immediately followed by a pipe in the Evidence table's first cell — the template's own `` `verify` skill — works in running app `` phrasing does NOT match (backtick breaks `\s*`). Use a bare `| verify |` cell label to satisfy the check.
**Files**: `.claude/hooks/pre_bash_block_unsafe_merge.py`, `tasks/TASK_GUIDE_T002.md`, `tasks/TASK_GUIDE_T003.md`

### 2026-07-03 — Local untracked `.env` can silently drift from `.env.example`
`apps/web/.env` is gitignored (untracked) and had `VITE_API_BASE_URL=http://localhost:3001` while the API's own `apps/api/.env` (`PORT=3000`) and the committed `apps/web/.env.example` both correctly say `3000`. This caused a real "Failed to fetch" error during T001's Stage 5 UI signup walkthrough — not a code bug, just local env drift. Fixed by editing the untracked `.env` directly (nothing to commit). When a UI flow fails with a network/fetch error, check the untracked `.env` against `.env.example`/the API's actual configured port before assuming an app bug.
**Files**: `apps/web/.env`, `apps/web/.env.example`, `apps/api/.env`

### 2026-07-03 — Archive external-tool evidence (screenshots, session reports) into this repo
`easy-ui-mcp` writes screenshots/session reports to its own repo's `reports/` dir by default (mounted volume), not this repo's. For durable Stage 5 UI-verify evidence, copy the relevant files into `kitchd/reports/evidence/<TASK_ID>/` and commit them — external tool output isn't guaranteed to persist or stay linkable. Done for T001: `reports/evidence/T001/*.png`, `*.json`, `*.html`.
**Files**: `reports/evidence/T001/**`, `tasks/TASK_GUIDE_T001.md`

### 2026-07-02 — CLAUDE.md, templates/, .claude/agents|hooks|skills are symlinks to ~/.supervisor/
This repo's `CLAUDE.md`, `templates/`, `.claude/agents/`, `.claude/hooks/`, `.claude/skills/` are all symlinks pointing to `/home/hungnguyenhuu/.supervisor/...` (a local, machine-specific path outside the repo). They must be excluded from git commits (`git add` them individually will fail portability for any other clone) — only `.claude/settings.json` and `.claude/settings.local.json` are real files in `.claude/`. First hit: initial `feat/kitchenos-planning` branch push (commit 1fef6ea), had to `git restore --staged` the symlinked paths after an initial `git add .claude/`.
