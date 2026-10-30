# TASK_GUIDE — M023: Fold leftover mobile colours into palette roles (no bluish tones on Graphite Mint)
**Date**: 2026-10-30
**Complexity Level**: C2
**Risk Level**: Medium (17 files incl. shared `src/components/FormFields.tsx`; presentation only)
**Priority**: P2
**Assigned agent**: mobile-developer
**Agent guide**: `agents/mobile-developer.md`
**Board**: `PROJECT_KANBAN_mobile.md`
**Brainstorming**: `BRAINSTORMING_LOG_m023-mobile-palette-roles.md` (Path B, user-confirmed 2026-10-30: "Merge near-duplicates")

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

**Design source**: `docs/design/graphite-mint/tokens.json`. Use its values exactly; never invent a colour.

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> On Graphite Mint, no mobile screen shows the old blue-grey inputs, borders, dividers, secondary text, warnings or selected panels — every colour comes from the theme palette. Simple looks the same, apart from a few near-identical shades merged into one.

Restated intent confirmed: user, 2026-10-30 ("ok, continue" + "Merge near-duplicates").

**New palette roles** (Simple → Graphite Mint):
| Role | Simple | Folds in (Simple) | Graphite Mint |
|---|---|---|---|
| `inputBackground` | `#101521` | — | `#0E100F` (bg-sunken) |
| `inputBorder` | `#2d374b` | — | `#2C3230` (line-strong) |
| `divider` | `#222b3a` | — | `#1F2321` (line-subtle) |
| `textSecondary` | `#ccd5e6` | `#cdd7ea`, `#c1cbe0` | `#ABB3AE` (text-2) |
| `hint` | `#8f9db4` | `#6f7c92` | `#8C9590` (text-muted) |
| `warning` | `#ffd27a` | `#ffc14d`, `#ffd28a` | `#E3B66B` (warn) |
| `success` | `#93e0a6` | — | `#7EDDB0` (accent) |
| `raised` | `#1d2740` | `#1f2a4d`, `#161d2b` | `#181B1A` (bg-raised) |

Existing roles absorb the rest: `#ff8a8a` / `#ff6b6b` → `danger` (badge text on it → `onAccent`); leftover `#f4f7ff`→`text`, `#0d1016`→`background`, `#86a0ff`→`accentSoft`, `#6b8cff`→`accent`, `#9ca9bf`→`muted`, `#171c26`→`surface`, `#273044`→`border`, `#ff8c8c`→`danger`. `'#ffffff'`: only where it sits on a themed fill (→ `onAccent`); otherwise leave and list it.

**Cut list**: fonts, glows, layout changes, renaming theme ids.

---

## Dependencies & Reachability

**Depends on**: M022 (Graphite Mint palette, `onAccent`), M018–M020 (`createStyles(palette)`)
**Entry point**: `apps/mobile/src/theme.ts` `PALETTES` → `useTheme()` on every screen
**Consumer**: every mobile user on Graphite Mint

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `Palette` gains the 8 roles above with the exact Simple and Graphite values; existing roles unchanged | palette |
| 2 | No `'#rrggbb'` literal remains in non-test files under `apps/mobile/app` and `apps/mobile/src` except a short, commented allow-list (e.g. `theme.ts` itself); a test enforces it | no bluish tones |
| 3 | Static-`StyleSheet` files (`announcements`, `dashboard`, `settings`, `src/components/{FormFields,AlertWidgets,ScreenFrame}.tsx`, others found) take colours from `useTheme()` via `createStyles(palette)` or inline overrides; `placeholderTextColor` included | coverage |
| 4 | Unread badge: `danger` fill with `onAccent` text | contrast |
| 5 | Tests: palette values pinned for both themes; at least one Graphite assertion per changed file group (inputs via `FormFields`, a divider, secondary text, warning, selected panel); existing theme tests updated, not deleted. New tests fail before the change (paste BEFORE) | test-first |
| 6 | Mobile test + typecheck pass; `expo export --platform ios` succeeds | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/mobile test && pnpm --filter @kitchenos/mobile typecheck
```
Device verification not available here (no simulator) — record as pending human device check.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M023.md`.

---

## Edge cases (from brainstorming)
- Simple: only the listed folds may change a pixel; every other Simple colour identical.
- Warning/error/success keep their words next to the colour.
- `FormFields`/`AlertWidgets`/`ScreenFrame` rendered on login/boot (no signed-in user) resolve Simple.
- Tests that assert old literals (`screenFrame.test.tsx`, `themeRolloutB.test.tsx` use `#010203`/`#123456` as sentinels) — keep sentinels working or update deliberately.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/mobile/src/theme.ts` | AC1 |
| `apps/mobile/app/*.tsx`, `app/task/[taskId].tsx`, `app/invite/accept.tsx` | AC2–AC4 |
| `apps/mobile/src/components/{FormFields,AlertWidgets,ScreenFrame}.tsx` | AC2–AC3 |
| `apps/mobile/src/*.test.ts(x)` | AC5 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/mobile/src/session.ts`, `storage.ts`, `api.ts` | not theme work |
| `apps/web/**`, `apps/api/**`, `packages/shared/**`, `apps/mobile/package.json` | out of scope |

---

## Completion checklist
- [ ] Implementation done
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Smoke test confirmed (device check pending — human)
- [ ] `memory/` updated (Supervisor)
- [ ] TASK_GUIDE marked complete
