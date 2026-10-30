# BRAINSTORMING_LOG — M023: fold leftover mobile colours into palette roles
**Date**: 2026-10-30 · **Tier**: Standard (one real choice) · **Risk**: Medium (17 files incl. shared `src/components/FormFields.tsx`; presentation only)

## The Problem Space
After M022, Graphite Mint covers the 9 palette roles, but ~200 colour literals left by M018–M020 stay hard-coded and bluish on the graphite theme (M022 code-review P2). Verified 2026-10-30 (`grep "'#xxxxxx'" apps/mobile/{app,src}`, non-test files):

| Group | Literals (uses) | Used as | Graphite Mint token |
|---|---|---|---|
| Input / panel fill | `#101521` (60) | backgroundColor | `bg-sunken` `#0E100F` |
| Control border | `#2d374b` (58) | borderColor | `line-strong` `#2C3230` |
| Row divider | `#222b3a` (18) | borderTopColor | `line-subtle` `#1F2321` |
| Secondary text | `#ccd5e6` (16), `#cdd7ea` (4), `#c1cbe0` (6) | body, segment, picker text | `text-2` `#ABB3AE` |
| Hint text | `#8f9db4` (16), `#6f7c92` (1) | notes, read-state | `text-muted` `#8C9590` |
| Warning | `#ffd27a` (4), `#ffc14d` (2), `#ffd28a` (1) | warning text | `warn` `#E3B66B` |
| Error | `#ff8a8a` (3), `#ff6b6b` (1 badge fill) | error text, unread badge | `danger` `#E8968F` |
| Success | `#93e0a6` (2) | success text | `accent` `#7EDDB0` |
| Selected panel | `#1d2740` (2), `#1f2a4d` (1), `#161d2b` (1) | selected selector / raised row | `bg-raised` `#181B1A` |
| Simple-role literals not yet themed | `#f4f7ff` (11), `#0d1016` (7), `#86a0ff` (8), `#6b8cff` (6), `#9ca9bf` (3), `#171c26` (3), `#273044` (3), `#ff8c8c` (2) | as their role | existing roles |

`'#ffffff'` (8) is white on non-accent fills (danger badge etc.) — check each, map only where it sits on a themed fill.

## The Alternatives
- **A — Exact roles.** One palette role per distinct shade (~17 new roles). Simple byte-identical. Palette becomes a list of near-duplicates nobody can choose between; Graphite maps several roles to the same token anyway.
- **B — Folded roles (recommended).** 7 new roles — `inputBackground`, `inputBorder`, `divider`, `textSecondary`, `hint`, `warning`, `success`, `raised` (8 with `raised`) — Simple value = the most-used shade of each group; near-duplicates fold in (e.g. `#c1cbe0` → `#ccd5e6`). Simple shifts imperceptibly on a few labels (same approach M019 used, accepted as P3). Error reuses `danger`.
- **C — Graphite-only override.** Leave the literals, wrap each in `isGraphite ? token : literal`. Simple untouched, but ~200 ternaries and the bluish literals live on — rejected (worst maintainability, 50% rule fails).

## 50% Rule Check
B is the smaller diff that still removes every literal: each site becomes `palette.<role>` inside the existing `createStyles(palette)` factories; Simple/Graphite values live once in `src/theme.ts`.

## Adversarial Review
- **B fails if** a folded shade is visibly different in Simple. Largest fold: `#c1cbe0` → `#ccd5e6` (ΔL ≈ 4%) and `#ffc14d` → `#ffd27a`. Containment: guide lists every fold; tests pin Simple role values.
- **B fails if** a static `StyleSheet` screen can't read the palette (announcements, dashboard, settings, `FormFields`, `AlertWidgets`, `ScreenFrame`). Containment: convert those to `createStyles(palette)` or inline overrides (M022 pattern).
- **B fails if** `FormFields.tsx` is used outside a theme provider. `useTheme()` falls back to the default (Simple) — verify.
- Unread badge `#ff6b6b` fill with white text → `danger` fill + `onAccent`? `#E8968F` with white is 2.4:1; use dark text on Graphite (a `onDanger` would be one more role — use `onAccent`, both are dark on Graphite / white on Simple).

## Recommended Path
**B.** Roles: `inputBackground #101521→#0E100F`, `inputBorder #2d374b→#2C3230`, `divider #222b3a→#1F2321`, `textSecondary #ccd5e6→#ABB3AE`, `hint #8f9db4→#8C9590`, `warning #ffd27a→#E3B66B`, `success #93e0a6→#7EDDB0`, `raised #1d2740→#181B1A` (Simple → Graphite).

## Surgical Scope
Touch: `apps/mobile/src/theme.ts`, the 17 files with literals, matching tests. Must not touch: `session.ts`, `storage.ts`, `api.ts`, `apps/web/**`, `packages/shared/**`, `package.json`.

## Edge Case Checklist for TASK_GUIDE
- Simple role values pinned by test; every fold listed in the report.
- Graphite: no `'#xxxxxx'` literal left in non-test mobile sources except documented exceptions (test asserts it).
- Warning/error/success text stays readable on both backgrounds; status keeps its word.
- Placeholder text colours in inputs (`placeholderTextColor`) included.
- Screens rendered outside a signed-in user (login, boot) still show Simple.

## Next Actions
TASK_GUIDE_M023 → `../kitchd-M023` → mobile-developer → code-review + security-review → merge → board/memory.

## User Selection
Path B — user chose "Merge near-duplicates (Recommended)", 2026-10-30.
