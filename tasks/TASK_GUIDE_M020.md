# TASK_GUIDE — M020: Theme palette rollout — group B (team, invites, login, invite accept, notifications, shift log, boot) + invite wording
**Date**: 2026-10-30
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P3
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Parallel wave**: M018 / M019 / M020 / M021 run concurrently in separate worktrees — stay inside your file list.

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> With Dark Neon selected, the team, invites, login, invite-accept, notifications, shift-log and boot screens use the palette; a Simple user sees no change. The invite-accept notice matches the web wording.

Restated intent confirmed: Supervisor (user asked to start all pending work in parallel, 2026-10-30).

**Pattern to copy**: `apps/mobile/app/announcements.tsx` + `src/announcementsTheme.test.tsx` (M006): `const { palette } = useTheme()`, palette values applied inline over the static `StyleSheet` (`[styles.x, { backgroundColor: palette.surface }]`).
**Mapping**: `#0d1016`→`background`, `#171c26`→`surface`, `#f4f7ff`→`text`, `#9ca9bf`→`muted`, `#6b8cff`→`accent`, `#86a0ff`→`accentSoft`, `#ff8c8c`→`danger`, `#273044`→`border`. Colours with no palette role (status badges, warnings, input fills) stay as they are — **do not add tokens to `src/theme.ts`** (another agent in this wave would conflict).
**Cut list**: no new palette roles, no light theme, no layout changes.
**Note**: on login (`app/index.tsx`) and boot (`app/_layout.tsx`) there may be no signed-in user — `useTheme()` then resolves the default (Simple), which is correct. `_layout.tsx` boot view: if it renders outside the theme provider, keep it Simple and say so.

---

## Dependencies & Reachability

**Depends on**: M006, M010, M013 (invite notice)
**Entry point**: `app/{team,invites,index,notifications,shift-logs,_layout}.tsx`, `app/invite/accept.tsx`
**Consumer**: every mobile user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Each listed screen takes the mapped colours from `useTheme()` palette | rollout |
| 2 | Theme test per screen (simple/dark-neon), like `announcementsTheme.test.tsx` | test-first |
| 3 | `app/invite/accept.tsx` notice reads exactly: "You are signed in as <email>. Accepting this invitation will sign you out of that account and sign you in as the invited user." (copy the rest of the sentence from `apps/web/src/routes/pages/AcceptInvitePage.tsx:79-84`; update `src/inviteAcceptScreen.test.tsx`) | M013 P3 |
| 4 | Simple renders the pre-change colours; mobile test + typecheck pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M020.md`.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/app/{team,invites,index,notifications,shift-logs,_layout}.tsx`, `app/invite/accept.tsx` | palette (+ notice wording) |
| `apps/mobile/src/themeRolloutB.test.tsx` (new), `src/inviteAcceptScreen.test.tsx` | AC2, AC3 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/theme.ts` | palette is fixed for this wave |
| `apps/web/**`, `apps/api/**`, `packages/shared/**` | out of scope |
| `apps/mobile/src/commentsSection.tsx` | M019 owns it |
| M018's screens | M018 owns them |

