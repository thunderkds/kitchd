# ADR-0001: Theme system — semantic CSS-variable tokens, account-synced via Prisma enum

**Status**: Accepted
**Date**: 2026-07-14

## Context

`apps/web` has no theming infrastructure. All color is expressed as raw Tailwind palette utility classes inline across 17 component files. The product needs a "Simple" (current look) and "Dark Neon" (new) theme, switchable per-user, with the architecture supporting additional themes later without re-touching components.

## Decision

1. **Token architecture**: semantic CSS custom properties (`--color-surface`, `--color-surface-raised`, `--color-text-primary`, `--color-text-muted`, `--color-accent`, `--color-border`, `--color-danger`, `--color-success`, `--color-warning`) mapped into Tailwind v4 via `@theme inline`. Each theme is a flat `[data-theme="..."]` CSS block in `index.css`. Components use semantic Tailwind classes (`bg-surface`, `text-primary`) instead of raw palette classes (`bg-slate-100`).
2. **Accent granularity**: single `--color-accent` token, not split primary/secondary. Current usage shows exactly one accent role (primary actions/links/focus); a second accent token would be speculative.
3. **Theme identifiers**: kebab-case string values `"simple"` / `"dark-neon"`, matching CSS attribute-selector syntax directly (no case translation needed between DB value, `data-theme` attribute, and API payload).
4. **Persistence**: `User.themePreference` — a Prisma **enum** column (`Theme { simple, dark_neon }`), not a plain String. Matches the existing `Role` enum convention in this schema and gives a DB-level constraint against invalid values. Adding a future theme requires a migration (new enum value) — this is intentional friction: a new theme is a deliberate, reviewed product change, not a config toggle.
5. **Rejected**: Tailwind's built-in `dark:` variant (Option A) — binary by construction, can't express theme #3. Rejected per-component `theme` prop / conditional className branching (Option C) — duplicates color values per component, violates Simplicity First, doesn't scale to N themes.

## Consequences

- Adding a future theme (#3+) is a pure CSS diff (`[data-theme="x"]` block) plus one Prisma enum-value migration — zero component code changes.
- All 17 currently-raw-color files must be migrated to semantic tokens in the same task that introduces the token system, to avoid a half-themed UI.
- The `Theme` enum is the single source of truth for valid theme values; the frontend must handle an unset/null `themePreference` (pre-migration existing users) by defaulting to `"simple"`, not crashing.

## Full record

See `BRAINSTORMING_LOG_theme-system.md` for the full alternatives analysis and adversarial review.
