# TASK_GUIDE — T052: Graphite Mint replaces Dark Neon on the web (tokens + key components)
**Date**: 2026-10-30
**Complexity Level**: C2
**Risk Level**: High (cross-cutting: every web screen; presentation only — no auth/API/DB change)
**Priority**: P1
**Assigned agent**: frontend-developer
**Agent guide**: `agents/frontend.md`
**Board**: `PROJECT_KANBAN.md`
**Brainstorming**: `BRAINSTORMING_LOG_graphite-mint.md` (Path B, user-confirmed 2026-10-30)
**Parallel wave**: T052 (web) and M022 (mobile) run concurrently in separate worktrees — stay inside your file list.

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `docs/adr/0001-theme-system-token-architecture.md` and `memory/MEMORY.md` are its equivalent.)

**Design source (read first)**: `docs/design/graphite-mint/README.md` (rules), `tokens.json` (exact values), `components.css` (reference CSS), `components/{Button,Card,SidebarNav,DataTable,Notice,ProgressBar}.md`. Use its values exactly; never invent a colour.

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> A web user who picks the dark theme sees Graphite Mint: graphite background, light-gray text, hairline outlines instead of gradients, a neon-mint primary button with dark text, the current sidebar page highlighted the Graphite way, a visible mint focus ring, and IBM Plex type. The theme is labelled "Graphite Mint" in Settings. A Simple user sees no change at all.

Restated intent confirmed: user, 2026-10-30 ("Replace Dark Neon", "Tokens + key components", "Go ahead").

**Keep**: internal theme id `dark-neon`, API value `dark_neon`, `themeMapping.ts`, `ThemeProvider.tsx`, the paint-time script in `index.html`. Only the visible label changes.

**Token values for `[data-theme='dark-neon']`** (from `tokens.json`):
| KitchenOS token | Graphite Mint token | Value |
|---|---|---|
| `--knos-surface` | `bg` | `#121413` |
| `--knos-surface-raised` / `-2` | `bg` (cards are outlined, not filled; no gradient: both stops equal) | `#121413` |
| `--knos-text-primary` | `text` | `#DCE0DD` |
| `--knos-text-muted` | `text-muted` | `#8C9590` |
| `--knos-accent` | `neon` | `#3CF5A8` |
| `--knos-border` | `line` (hairlines on, Graphite only) | `#262B29` |
| `--knos-border-input` | `line-strong` | `#2C3230` |
| `--knos-danger` | `danger` | `#E8968F` |
| `--knos-success` | `accent` | `#7EDDB0` |
| `--knos-warning` | `warn` | `#E3B66B` |
| **new** `--knos-on-accent` | `on-neon` (Simple: `#ffffff`) | `#0E100F` |

Further Graphite-only values as needed (hover `bg-raised #181B1A`, inputs/table headers `bg-sunken #0E100F`, nav `neon-soft`/`neon-line`, `glow-box`, `glow-text`) — scoped under `[data-theme='dark-neon']`.

**Cut list** (Simplicity First): layout shell (header/sidebar sizes, stat strips, step grids, code boxes, family nav), mono labels/eyebrows, a light Graphite variant, renaming the theme id.

---

## Dependencies & Reachability

**Depends on**: T026 (theme tokens + switcher), T025 (theme preference API)
**Entry point**: `apps/web/src/pages/Settings/SettingsPage.tsx` (theme picker) → `[data-theme]` on `<html>`; `apps/web/src/layout/Sidebar.tsx`
**Consumer**: every web user who chooses the dark theme

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `[data-theme='dark-neon']` in `apps/web/src/index.css` holds the values in the table above; `:root, [data-theme='simple']` values are **byte-identical** to before | tokens |
| 2 | New `--color-on-accent` token (`@theme inline`, Simple `#ffffff`, Graphite `#0E100F`); every accent-filled control (`bg-accent` + `text-white`) uses `text-on-accent` instead — no `text-white` left on a `bg-accent` element | contrast 1.3:1 → 14:1 |
| 3 | Graphite only: cards/boxes show 1px `line` borders and no gradient; inputs/selects/textareas use `bg-sunken` fill and `line-strong` border | Card, inputs |
| 4 | Graphite only: primary (accent-filled) buttons get `glow-box`; disabled ones keep the existing opacity and lose the glow. Where one row/form shows two or more accent-filled buttons, only the main action stays filled; the others use the secondary outline style (transparent, `line-strong` border, `text`) — list each one you changed | Button "one primary per section" |
| 5 | Sidebar active item: Simple unchanged (`bg-accent` + on-accent text); Graphite = `neon-soft` background, `neon` text with `glow-text`, inset 1px `neon-line` ring, weight 500. Inactive hover = `bg-raised` | SidebarNav |
| 6 | Graphite only: every `a`, `button`, `[role=button]`, input, select, textarea shows a 2px solid `neon` focus ring with 2px offset on `:focus-visible` | Accessibility |
| 7 | Graphite only: body font is IBM Plex Sans (weights 400/500/600), `font-mono` resolves to IBM Plex Mono; loaded from Google Fonts in `apps/web/index.html` with `display=swap`; falls back to `system-ui` | Typography |
| 8 | Settings shows the option as **"Graphite Mint"** with description "A dark graphite theme with a mint highlight."; selecting it still sends `dark_neon` | label |
| 9 | Notices/banners and progress bars (if any exist) follow `Notice.md` / `ProgressBar.md` in Graphite; status colours are always paired with a word (no colour-only status) | Notice, ProgressBar |
| 10 | Tests: a token test asserting Simple values unchanged and Graphite values as above; a test that no `bg-accent` element in rendered key screens keeps `text-white`; Settings label test; existing tests that assert "Dark Neon" text updated (not deleted). Every new test fails before the change (paste BEFORE) | test-first |
| 11 | `pnpm --filter @kitchenos/web test`, `build` and `lint` pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/shared build && pnpm --filter @kitchenos/web test && pnpm --filter @kitchenos/web build && pnpm --filter @kitchenos/web lint
```
Visual check: if a browser is available, run the dev server on `localhost:8766` and screenshot Dashboard, Tasks and Settings in both themes to `reports/evidence/T052/`. Otherwise record "visual check pending (human)".

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_T052.md`.

---

## Edge cases (from brainstorming)
- Simple must not change: every new rule scoped to `[data-theme='dark-neon']`, on-accent Simple = `#ffffff`.
- `bg-accent/10` chips and `border-accent` uses must read as a soft mint tint, not a solid neon block — check each (`grep -rn "bg-accent/10\|border-accent" apps/web/src`).
- Danger/warning text on `#121413` stays readable; keep the word next to the colour.
- Dialog overlays and dropdown (`<select>`) panels still readable (the flat `background-color` fallback stays).
- A saved `dark_neon` user lands on Graphite Mint with no flash (paint-time id unchanged).
- Google Fonts unreachable → system font, nothing breaks.

---

## Files to change (predicted)

| File | Change |
|------|--------|
| `apps/web/src/index.css` | AC1–AC7, AC9 |
| `apps/web/index.html` | AC7 font `<link>` only — do not touch the paint-time script |
| `apps/web/src/layout/Sidebar.tsx` | AC5 |
| `apps/web/src/**/*.tsx` with `bg-accent … text-white` | AC2, AC4 |
| `apps/web/src/pages/Settings/SettingsPage.tsx` | AC8 |
| tests (`*.test.ts(x)`) | AC10 |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/web/src/theme/themeMapping.ts`, `ThemeProvider.tsx` | ids unchanged |
| `apps/api/**`, `packages/shared/**` | no API/DB change |
| `apps/mobile/**` | M022 owns it |

---

## Completion checklist
- [ ] Implementation done
- [ ] Lint passes
- [ ] Tests pass
- [ ] Visual check (screenshots or pending human)
- [ ] `memory/` updated (Supervisor)
- [ ] TASK_GUIDE marked complete
