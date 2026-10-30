# TASK_GUIDE — M022: Graphite Mint replaces Dark Neon on mobile (palette + key components)
**Date**: 2026-10-30
**Complexity Level**: C2
**Risk Level**: High (cross-cutting: every mobile screen; presentation only — no auth/API/storage change)
**Priority**: P1
**Assigned agent**: mobile-developer
**Agent guide**: `agents/mobile-developer.md`
**Board**: `PROJECT_KANBAN_mobile.md`
**Brainstorming**: `BRAINSTORMING_LOG_graphite-mint.md` (Path B, user-confirmed 2026-10-30)
**Parallel wave**: T052 (web) and M022 (mobile) run concurrently in separate worktrees — stay inside your file list.

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

**Design source (read first)**: `docs/design/graphite-mint/README.md` (rules), `tokens.json` (exact values), `components/{Button,Card,SidebarNav,Notice,ProgressBar}.md`. Use its values exactly; never invent a colour.

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> A mobile user who picks the dark theme sees Graphite Mint: graphite background, light-gray text, outlined cards, neon-mint primary buttons with dark readable text, soft-mint links and kickers. It is labelled "Graphite Mint" in Settings. A Simple user sees no change at all.

Restated intent confirmed: user, 2026-10-30 ("Replace Dark Neon", "Tokens + key components", "Go ahead").

**Keep**: theme id `dark-neon`, `toApiTheme`, `resolvePalette`, `session.ts`, `storage.ts`. Only values, one new role and the label change.

**`PALETTES['dark-neon']`** (from `tokens.json`):
| Role | Graphite Mint token | Value |
|---|---|---|
| `background` | `bg` | `#121413` |
| `surface` | `bg-raised` (mobile cards keep a fill; documented deviation) | `#181B1A` |
| `text` | `text` | `#DCE0DD` |
| `muted` | `text-muted` | `#8C9590` |
| `accent` | `neon` | `#3CF5A8` |
| `accentSoft` | `accent` (soft mint, links/kickers) | `#7EDDB0` |
| `danger` | `danger` | `#E8968F` |
| `border` | `line` | `#262B29` |
| **new** `onAccent` | `on-neon` (Simple: `#ffffff`) | `#0E100F` |

**Cut list** (Simplicity First): IBM Plex fonts on mobile (new native dependency + boot delay — user accepted), glows (RN shadows are iOS-only), the ~60 off-palette hex shades left by M018–M020 (`#8f9db4`, `#ccd5e6`, …), layout changes, renaming the theme id.

---

## Dependencies & Reachability

**Depends on**: M006 (theme preference), M018/M019/M020 (screens on `createStyles(palette)`)
**Entry point**: `apps/mobile/app/settings.tsx` (theme picker) → `useTheme()` palette on every screen
**Consumer**: every mobile user who chooses the dark theme

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `PALETTES['dark-neon']` holds the values above; `PALETTES.simple` keeps every existing value and gets `onAccent: '#ffffff'` | palette |
| 2 | `Palette` gains `onAccent`; every text/icon drawn **on an accent fill** (primary buttons, active chips/tabs, badges with `backgroundColor: palette.accent`) uses `palette.onAccent` instead of `'#ffffff'` — list each file/style changed. White text on non-accent backgrounds stays as it is | contrast 1.3:1 → 14:1 |
| 3 | `THEME_OPTIONS` label **"Graphite Mint"**, description "A dark graphite theme with a mint highlight."; picking it still stores `dark-neon` / sends `dark_neon` | label |
| 4 | Where a screen shows two or more accent-filled buttons side by side, only the main action stays filled; others become outline (transparent, `palette.border` 1px, `palette.text`) — in both themes only if Simple already had them filled the same way; otherwise Graphite-only. List each change | Button "one primary per section" |
| 5 | Tests: palette test (Simple unchanged + Graphite values), an on-accent test on at least the primary-button screens touched (Graphite → `#0E100F`, Simple → `#ffffff`), settings label test; existing tests asserting "Dark Neon" updated, not deleted. Every new test fails before the change (paste BEFORE) | test-first |
| 6 | Mobile test + typecheck pass; `expo export --platform ios` succeeds | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M022.md`.

---

## Edge cases (from brainstorming)
- Simple must not change: `onAccent` Simple = `#ffffff`; no other Simple value edited.
- `accentSoft` text on `surface #181B1A` and `background #121413` stays ≥ 4.5:1 (`#7EDDB0` ≈ 11:1).
- Danger text `#E8968F` on graphite stays readable; keep words with status colours.
- `'#ffffff'` used on a non-accent background (e.g. on a danger fill) is not an accent case — leave it.
- The boot screen / login render Simple (no signed-in user) — unchanged.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/theme.ts` | AC1–AC3 |
| `apps/mobile/app/*.tsx`, `app/task/[taskId].tsx`, `app/invite/accept.tsx`, `src/commentsSection.tsx` | AC2, AC4 (accent-fill text only) |
| `apps/mobile/src/*.test.ts(x)` | AC5 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/session.ts`, `storage.ts`, `api.ts` | not theme work |
| `packages/shared/**`, `apps/api/**` | ids unchanged |
| `apps/web/**` | T052 owns it |
| `apps/mobile/package.json` | no new dependency (fonts cut) |

---

## Completion checklist
- [ ] Implementation done
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Smoke test confirmed (device check pending — human)
- [ ] `memory/` updated (Supervisor)
- [ ] TASK_GUIDE marked complete
