# TASK_GUIDE — M018: Theme palette rollout — group A (tasks, task detail, recipes, guidelines, notes, inventory)
**Date**: 2026-10-30
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P3
**Assigned agent**: mobile-developer
**Agent guide**: `agents/mobile-developer.md`
**Board**: `PROJECT_KANBAN_mobile.md`
**Parallel wave**: M018 / M019 / M020 / M021 run concurrently in separate worktrees — stay inside your file list.

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> With Dark Neon selected, the task, task-detail, recipe, guideline, note and inventory screens use the palette accent instead of the hard-coded Simple blue; a Simple user sees no change.

Restated intent confirmed: Supervisor (user asked to start all pending work in parallel, 2026-10-30).

**Pattern to copy**: `apps/mobile/app/announcements.tsx` + `src/announcementsTheme.test.tsx` (M006): `const { palette } = useTheme()`, palette values applied inline over the static `StyleSheet` (`[styles.x, { backgroundColor: palette.surface }]`).
**Mapping**: `#0d1016`→`background`, `#171c26`→`surface`, `#f4f7ff`→`text`, `#9ca9bf`→`muted`, `#6b8cff`→`accent`, `#86a0ff`→`accentSoft`, `#ff8c8c`→`danger`, `#273044`→`border`. Colours with no palette role (status badges, warnings, input fills) stay as they are — **do not add tokens to `src/theme.ts`** (another agent in this wave would conflict).
**Cut list**: no new palette roles, no light theme, no layout changes.

---

## Dependencies & Reachability

**Depends on**: M006 (palette + `useTheme`), M010 (`ScreenFrame`)
**Entry point**: `app/{tasks,recipes,guidelines,notes,inventory}.tsx`, `app/task/[taskId].tsx`
**Consumer**: every mobile user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Each of the 6 screens calls `useTheme()` and takes background/surface/text/muted/accent/accentSoft/danger/border from the palette wherever it hard-coded the mapped hex | rollout |
| 2 | Theme test per screen (`it.each` over simple/dark-neon, like `announcementsTheme.test.tsx`): background + one accent element match the palette | test-first |
| 3 | Simple palette renders the exact pre-change colours (the mapping is identity for Simple) | no regression |
| 4 | mobile test + typecheck pass; existing screen tests untouched or minimally adjusted | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M018.md`.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/app/{tasks,recipes,guidelines,notes,inventory}.tsx`, `app/task/[taskId].tsx` | palette |
| `apps/mobile/src/themeRolloutA.test.tsx` (new) | AC2 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/theme.ts` | palette is fixed for this wave |
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |
| `apps/mobile/src/commentsSection.tsx` | M019 owns it |
| M020's screens (team, invites, index, invite/accept, notifications, shift-logs, _layout) | M020 owns them |

