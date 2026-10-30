# BRAINSTORMING_LOG — Graphite Mint UI/UX update (web T052 + mobile M022)
**Date**: 2026-10-30 · **Tier**: Standard · **Risk**: High (cross-cutting: every screen on two apps; presentation only, no auth/DB/API change)

**Source design system**: Graphite Mint — https://claude.ai/artifact/7DkuKJzMN6tJ9S8v2fNE8b (`project/README.md`, `project/tokens.json`, `project/components/bundle.css`, component READMEs).

**User decisions (2026-10-30)**:
1. Graphite Mint **replaces Dark Neon**. Simple stays. Stored/API theme values unchanged (`dark_neon` / `dark-neon`).
2. Scope = **tokens + key components** (buttons, cards, inputs, nav, tables, notices, progress bars). Screen layouts unchanged.

## The Problem Space
Both apps already route colour through one token layer, so the swap is mostly values — but four things in the current code clash with Graphite Mint's rules (all verified 2026-10-30):

| Clash | Where | Why it matters |
|---|---|---|
| Accent buttons use **white text** | web: `bg-accent text-white` (31 `bg-accent`, 32 `text-white`); mobile: 25× `color: '#ffffff'` on accent fills | White on neon `#3CF5A8` is ~1.3:1 — unreadable. Graphite Mint requires `on-neon` `#0E100F` (14:1). Needs a new **on-accent** token. |
| Borders are **transparent**, cards use a **gradient** | `apps/web/src/index.css` `--knos-border: transparent` + `.bg-surface-raised` linear-gradient | Graphite Mint: "Structure from hairlines… Cards are outlined, not filled. No gradients." Fixable per-theme in tokens only (border = `line`, gradient stop 2 = stop 1). |
| Active nav = solid accent fill + white text | `apps/web/src/layout/Sidebar.tsx:23` `bg-accent text-white` | System: active item = `neon-soft` bg, `neon` text, inset `neon-line` ring. |
| No focus ring anywhere | no `focus:`/`focus-visible:` classes in `apps/web/src` | System requires a 2px neon focus ring. One global rule. |

Mobile: `apps/mobile/src/theme.ts` `PALETTES['dark-neon']` is the same navy base as Simple with a pink accent; `Palette` has 8 roles and no on-accent. Mobile has no light theme (Simple is dark navy) — so Graphite Mint is a pure palette swap there.

## The Alternatives
- **A — Value swap only.** Change the `[data-theme='dark-neon']` values and the mobile palette, relabel "Dark Neon" → "Graphite Mint". ~30 lines. **Fails**: accent buttons become white-on-neon (unreadable); borders stay invisible; doesn't meet the chosen scope.
- **B — Tokens + component pass (recommended).** A, plus:
  - new token **on-accent** (web `--color-on-accent`, mobile `palette.onAccent`): Simple = `#ffffff` (no visual change), Graphite = `#0E100F`; replace `text-white`/`'#ffffff'` on accent fills with it.
  - new tokens for **warn/line/neon-soft/neon-line/link**, Graphite block only sets hairline borders (`--knos-border: #262B29`), flat cards (stop 2 = stop 1), input border `#2C3230`, sunken inputs/table headers.
  - **Sidebar active state**, **primary button glow**, **global focus ring**, **notice** and **progress bar** styling — via theme-scoped CSS (`[data-theme='dark-neon'] …`) so Simple is untouched.
  - **IBM Plex Sans/Mono** on web via Google Fonts, applied under Graphite only; mono for numbers/labels where the component rule says so.
  - Mobile: palette values + `onAccent` + `line`/`warn` roles; accent-fill text → `onAccent`; active-tab / primary-button styling per system.
- **C — Rename end to end** (`graphite-mint` id, Prisma enum migration, API, shared package). Rejected without debate: user said API/DB unchanged; a schema migration for a label is High risk for no user benefit.

## 50% Rule Check
B rides on the existing token layer: borders, cards and inputs change through **token values only** (no component file edits); only the accent-fill text and the nav active state need class edits. Theme-scoped CSS keeps the Simple theme byte-identical, so there is no Simple regression surface to test beyond "unchanged".

## Adversarial Review
- **B fails if** Simple changes by accident (on-accent default not `#ffffff`, a rule not scoped to `[data-theme='dark-neon']`). Containment: snapshot/assert Simple token values unchanged; every new rule scoped.
- **B fails if** neon is overused (31 accent buttons on screen at once on some pages). The system says ~6 neon elements per screen. Containment: only *primary* actions keep the neon fill; secondary actions (`Cancel`, `Delete` confirm, row actions) use the outline style — implementer lists which buttons stayed primary.
- **B fails if** Google Fonts is blocked (offline kitchen tablet). Containment: Plex stack falls back to `system-ui`; no layout depends on the font metrics.
- **Mobile fonts**: adding `@expo-google-fonts/ibm-plex-*` is a new native-asset dependency and delays boot until fonts load. **Cut for M022** (system font stays); revisit on request.

## Recommended Path
**B.** Keep the internal id `dark-neon` / API `dark_neon`; only the user-visible label becomes **"Graphite Mint"** with description "A dark graphite theme with a mint highlight." Two tasks, disjoint files, run in parallel:
- **T052 (web, `PROJECT_KANBAN.md`)** — `apps/web/src/index.css`, `apps/web/index.html` (font link only), `apps/web/src/layout/Sidebar.tsx`, accent-fill classes across `apps/web/src/**`, `SettingsPage.tsx` label, tests.
- **M022 (mobile, `PROJECT_KANBAN_mobile.md`)** — `apps/mobile/src/theme.ts`, accent-fill text in `apps/mobile/app/**` + `src/commentsSection.tsx`, label, tests.

## Surgical Scope
Touch: files above. Must not touch: `apps/api/**`, `packages/shared/**` (theme ids), `apps/web/src/theme/themeMapping.ts`, the paint-time script logic in `apps/web/index.html`, `ThemeProvider.tsx`, mobile `session.ts`/`storage.ts`.

## Edge Case Checklist for TASK_GUIDEs
- Simple theme renders exactly as before (token values and on-accent `#ffffff` unchanged).
- Every accent-filled control is readable in both themes (text ≥ 4.5:1: `on-accent` on accent).
- Disabled primary buttons still look disabled on neon (opacity rule kept).
- Danger/warning text stays readable on `#121413` (`danger #E8968F`, `warn #E3B66B`); status always paired with a word.
- A user whose saved preference is `dark_neon` lands on Graphite Mint with no migration and no flash (paint-time cache id unchanged).
- Keyboard focus visible on every link/button in Graphite (2px neon, 2px offset).
- `bg-accent/10` chips and `border-accent` uses still look intended with neon (soft tint, not a solid block).
- Mobile: the `simple` palette object is unchanged; tests that assert "Dark Neon" text are updated to the new label, not deleted.

## Cut list
- Mobile IBM Plex fonts (new native dependency, boot delay).
- Off-palette mobile hex shades (`#8f9db4`, `#ccd5e6`, `#c1cbe0`… ~60 uses) — left as M018–M020 left them; revisit as a follow-up.
- Layout shell (64px header, 248px sidebar, stat strips) — user chose "layouts unchanged".
- Light variant of Graphite Mint — the system is dark-only.

## Visual probe
The design system's own component previews are the visual reference (layouts unchanged), so no ASCII mockup is needed.

## Next Actions
TASK_GUIDE_T052 + TASK_GUIDE_M022 → worktrees `../kitchd-T052`, `../kitchd-M022` → frontend-developer + mobile-developer in parallel → code-review + security-review each → merge → board/memory.

## User Selection
Path B — confirmed by the user 2026-10-30 ("Go ahead").
