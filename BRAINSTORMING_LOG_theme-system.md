# BRAINSTORMING_LOG.md
**Generated**: 2026-07-14
**Task / Context**: Theme system — "Simple" (current) + "Dark Neon" (new), account-synced, future-extensible token architecture
**Skill**: `Skill({ skill: "brainstorming" })`

---

## The Problem Space

Today `apps/web` has zero theming infrastructure: no CSS variables, no `@theme` block, no theme/dark-mode code, no `localStorage` usage, no React context providers of any kind. All color is expressed as raw Tailwind palette utility classes (`bg-slate-100`, `text-gray-700`, etc.) inline across 17 component files.

The ask is not "add dark mode" (a binary toggle) — it's "add a **named theme system**" where "Simple" (today's look) and "Dark Neon" (new) are both first-class themes, more themes can be added later without re-touching every component, and the active theme follows the **user's account** (DB-backed), not just the browser.

Non-negotiable constraints locked with the user:
- Persistence: account-synced (`User.themePreference` in Postgres via Prisma), not just `localStorage`.
- Migration: full migration of all 17 files to semantic tokens in this task — no half-themed screens.
- Switcher UI: lives on a settings/profile page (not the topbar).
- Must support N future themes, not just a light/dark binary.

---

## Alternative Paths

| Option | Name | Summary | Invasiveness | Code Volume | Regression Risk | Recommended? |
|--------|------|---------|-------------|------------|----------------|--------------|
| A | Tailwind `dark:` variant | Use Tailwind's built-in `dark` class strategy | Low | ~150 lines | Low | |
| B | Semantic CSS-variable tokens + `data-theme` attribute | Central token layer, Tailwind `@theme inline` maps to CSS vars, themes are CSS blocks | Medium | ~400 lines | Medium | ✅ Yes |
| C | Per-component theme prop / CSS-in-JS variants | Pass `theme` prop, conditional className logic per component | High | ~700+ lines | High | |

### Option A — Tailwind `dark:` variant
**Approach**: Use Tailwind v4's `dark:` variant (class-based, toggled via a `dark` class on `<html>`). Map "Dark Neon" onto the `dark:` prefix; "Simple" is the default (no class).
**Pros**: Zero new abstraction — Tailwind already supports this natively. Least code to write for exactly two themes.
**Cons**: Fundamentally a **binary** switch (light/dark), not a named-theme system. Adding a third theme ("Ocean", "Retro", whatever comes next) has nowhere to go — `dark:` can't express "theme C." Directly contradicts the "future themes added easily" requirement.
**Why it might fail**: The moment a third theme is requested, this whole approach gets ripped out and rebuilt as Option B anyway — wasted work now, and a painful migration under time pressure later.

### Option B — Semantic CSS-variable tokens + `data-theme` attribute
**Approach**: Define a small set of **semantic tokens** (`--color-surface`, `--color-surface-raised`, `--color-text-primary`, `--color-text-muted`, `--color-accent`, `--color-border`, `--color-danger`, `--color-success`, `--color-warning`, etc.) as CSS custom properties. Each theme is a flat CSS block keyed by `[data-theme="simple"] { ... }` / `[data-theme="dark-neon"] { ... }` in `index.css`. Tailwind v4's `@theme inline` block maps Tailwind's own color utilities (`bg-surface`, `text-primary`, `border-default`, etc.) to `var(--color-*)`, so components keep using ordinary Tailwind classes — just semantic ones instead of raw palette ones (`bg-slate-100` → `bg-surface`). The active theme is set by a `data-theme` attribute on `<html>`, applied by a tiny `ThemeProvider` context that reads from the authenticated user's `themePreference` (falling back to `"simple"` for logged-out/unset).
**Pros**: Adding theme #3 later is a **pure CSS diff** — one new `[data-theme="x"]` block, zero component changes, because components only ever reference semantic tokens. Matches the explicit "future themes" requirement exactly. Single source of truth for every color in the app (currently there is none — this is a net simplification, not just new machinery).
**Cons**: Requires touching every one of the 17 files that reference raw Tailwind color classes (already agreed/in-scope). Requires designing a token palette up front — needs a bit of care to get the semantic names right so they cover every current raw-color usage.
**Why it might fail**: If the semantic token set is too coarse (e.g. one `--color-accent` when the UI actually needs 3 distinct accent roles), some components will look wrong in Dark Neon and someone will be tempted to sneak a raw Tailwind color back in, quietly breaking the single-source-of-truth property. Mitigated by grepping actual current usage (already done — 17 files, mostly slate/gray/indigo/red/green/amber) to derive the token set from real usage, not guesswork.

### Option C — Per-component theme prop / CSS-in-JS variants
**Approach**: Each component receives a `theme` prop or reads `useTheme()` and branches its className logic (`theme === 'dark-neon' ? 'bg-black text-fuchsia-400' : 'bg-white text-slate-900'`).
**Pros**: No new CSS-variable infrastructure to design.
**Cons**: Every component becomes theme-aware individually — the definition of the abstraction bloat the Karpathy principles explicitly warn against. Adding theme #3 means editing every single component's conditional again. Duplicates color values instead of centralizing them.
**Why it might fail**: This is the "abstraction that doesn't scale" failure mode by construction — directly violates "design the color token architecture so future themes can be added easily," which is the actual ask.

---

## 50% Rule Check

Option B's ~400-line estimate is already the lean version. The place code volume could balloon is over-designing the token set (e.g. per-component tokens instead of per-role tokens). Cutting to **8–10 semantic tokens** derived from the actual 17-file grep (surface, surface-raised, text-primary, text-muted, accent, border, danger, success, warning) rather than a large speculative palette keeps this near the minimum viable token set — no token should be added unless a current raw-color usage maps to it.

---

## Recommended Path

**Option B — Semantic CSS-variable tokens + `data-theme` attribute**

This is the only option that satisfies "future themes can be added easily" without a rewrite, and it happens to also be the industry-standard pattern for Tailwind v4 theming (`@theme inline` + CSS custom properties + `data-theme`). It centralizes color definitions that today don't exist at all, which is a genuine simplification of the current ad-hoc state, not just new complexity for its own sake.

---

## Surgical Scope

Files/areas that **should** be touched:
- `apps/web/src/index.css` — add `@theme inline` token mapping + two `[data-theme]` blocks (simple, dark-neon)
- `apps/web/src/main.tsx` — wire theme initialization before first paint (avoid flash of wrong theme)
- New: `apps/web/src/theme/ThemeProvider.tsx` (or similar) — context reading/writing the active theme, calling the account API
- All 17 `.tsx` files currently using raw Tailwind color classes — migrate to semantic token classes
- Settings/profile page (existing or new, TBD in planning) — theme switcher control
- `apps/api/prisma/schema.prisma` — additive `themePreference` column on `User`
- `apps/api` — small endpoint (e.g. `PATCH /users/me/theme` or extend an existing profile update route) + include `themePreference` in the auth/me payload
- `apps/web` auth context — surface `themePreference` from the logged-in user

Files that **must not** be touched:
- Business-logic modules unrelated to rendering (Inventory/Recipe/Task services, RBAC guards, etc.) — this is a purely presentational + one small profile-field change
- `RealtimeGateway` / Socket.IO handlers — no realtime dimension to a theme preference

---

## Edge Case Checklist for TASK_GUIDE

- [ ] Flash of default/wrong theme before the account's `themePreference` loads (need a sensible pre-auth default + no visible flash — e.g. read cached last-known theme synchronously before paint, reconcile with server after auth resolves)
- [ ] Logged-out / unauthenticated views (login page) — must still render sensibly; no account to read a preference from
- [ ] User has no `themePreference` set yet (existing users pre-migration) — must default to `"simple"`, not null/undefined/crash
- [ ] Invalid/unknown theme value in DB (e.g. future theme removed) — client must fall back to `"simple"` rather than rendering unstyled
- [ ] Cross-tab consistency — if the user changes theme in one tab, should other open tabs reflect it (out of scope for MVP, but note as a known gap)
- [ ] Every one of the 17 migrated files re-verified visually in both themes — no missed raw-color class left behind that breaks Dark Neon contrast/legibility
- [ ] Migration for `themePreference` is additive and nullable-with-default — no backfill required, no downtime

---

## Next Actions

1. Confirm exact semantic token list against real usage before Stage 2 planning (derive from the 17-file color-class grep, not from scratch).
2. `grill-with-docs` (requested by user) — sharpen "Simple"/"Dark Neon" terminology, lock the token naming convention, and record this as an ADR in `memory/decisions.md` before task breakdown.
3. Stage 2 `/plan`: split into a small backend slice (User.themePreference + endpoint, C1/Low Risk, additive migration → `migration-safety` gate) and a frontend slice (token system + full 17-file migration + ThemeProvider + switcher UI, C2/Low Risk given no security-sensitive surface).

---

## User Selection

> **Approved direction**: Option B — Semantic CSS-variable tokens + `data-theme` attribute
> Approved by user on 2026-07-14 (via persistence/migration-scope/switcher-location Q&A during brainstorming).
