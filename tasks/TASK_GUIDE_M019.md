# TASK_GUIDE — M019: Comment replies on task detail (web parity) + themed comments section
**Date**: 2026-10-30
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P3
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Parallel wave**: M018 / M019 / M020 / M021 run concurrently in separate worktrees — stay inside your file list.

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> On a task's comments, a user who can comment can reply to a top-level comment; replies show indented under their parent (single level, like web `Comments.tsx`); the comments section uses the theme palette.

Restated intent confirmed: Supervisor (user asked to start all pending work in parallel, 2026-10-30).

**Facts**: `createComment` already accepts `parentId` (`apps/mobile/src/api.ts:599-604`); the API rejects replies to replies (`apps/api/src/comments/comments.service.ts:95-110`) — so only top-level comments get a Reply button. Web reference: `apps/web/src/components/Comments/Comments.tsx:16,57-59`.
**Cut list**: no nested threads, no @mention autocomplete changes.

---

## Dependencies & Reachability

**Depends on**: M007 (comments section), M006 (palette)
**Entry point**: `apps/mobile/src/commentsSection.tsx` (rendered by `app/task/[taskId].tsx`)
**Consumer**: every mobile user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Top-level comments render with their replies grouped under them (filter by `parentId`), replies visually indented | threading |
| 2 | Each top-level comment has a Reply action (hidden for VIEWER, same rule as the existing composer); submitting posts `createComment({ ..., parentId })` and the reply appears after refetch/invalidate | reply |
| 3 | Replies have no Reply action | single level |
| 4 | Comments section takes colours from `useTheme()` palette (mapping as in M018/M020) | theme |
| 5 | Tests in `src/commentsSection.test.tsx`: grouping, reply posts with parentId, VIEWER sees no Reply, reply has no Reply; mobile test + typecheck pass | test-first |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M019.md`.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/commentsSection.tsx` | AC1–4 |
| `apps/mobile/src/commentsSection.test.tsx` | AC5 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/theme.ts` | palette is fixed for this wave |
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |
| `apps/mobile/app/task/[taskId].tsx` | M018 owns it — the section must work without changing its host |
| `apps/mobile/src/api.ts` | API client already supports `parentId` |

