# TASK_GUIDE — T026: Frontend theme system — tokens, Dark Neon palette, full migration, switcher UI
**Date**: 2026-07-14
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. Note the **Complexity Level** above (C2) and apply the matching process from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. C2 — read `memory/codebase-map.md` for directory layout before starting (this task touches ~20 files)

Also read `docs/adr/0001-theme-system-token-architecture.md` (the architecture decision this task implements) and `BRAINSTORMING_LOG_theme-system.md` for full context.

---

## Requirement (Pillar 1 — Adapt the requirement)

User request: "implement a new theme, which can call the dark neon, allow to switch. Current theme can call as 'Simple', for the css, notice about the reuse or define the color tempo to define any theme in the future."

**Restated intent** (Supervisor's interpretation):
> Introduce a semantic color-token layer so all of `apps/web`'s existing look becomes the "Simple" theme, add a "Dark Neon" theme as a second `[data-theme]` CSS block, migrate every component off raw Tailwind palette classes onto the new semantic tokens, and let the user switch between themes from a settings/profile page — with the choice read from and written to the account (via T025's endpoint), so it follows them across devices.

**Out of scope** (what this task explicitly does NOT do):
- No backend work — T025 must already provide `themePreference` in the auth payload and the `PATCH .../theme` endpoint; this task consumes it.
- No cross-tab live sync (a theme change in one open tab does not push to other open tabs) — explicitly deferred per BRAINSTORMING_LOG_theme-system.md.
- No third theme — only "simple" and "dark-neon" ship; the architecture must make a future theme addable as a pure CSS diff, but no third theme is built now.
- No topbar quick-toggle — switcher lives only on the settings/profile page, per locked decision.

**Requirement Refs** (FR/NFR/US IDs from `PRD.md` this task satisfies):
- FR-025: user-selectable UI theme, extensible architecture.
- US-014: theme choice follows the user across devices.
- NFR-005: responsive/mobile-first — Dark Neon must not regress existing responsiveness (T021).

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [ ] Restated intent confirmed to match the user's request (by Supervisor / user — not the implementing agent)
- [ ] Domain terms align with `PROJECT_SPEC.md` glossary — theme IDs `"simple"`/`"dark-neon"` (kebab-case, matches CSS attribute selectors — note this differs in casing from the backend `Theme` enum's `simple`/`dark_neon`; the frontend must map between them, see Edge Case Checklist)
- [ ] Every Acceptance Criterion below traces to a line in the Requirement
- [ ] All Requirement Refs exist in `PRD.md` and are fully covered by the Acceptance Criteria above
- [ ] Confirmed T025 is merged and its endpoint/payload shape is verified in the actual code (not assumed) before starting

> An agent must NOT start implementing until this gate is checked. If anything here is unclear,
> STOP and ask the Supervisor (Karpathy: Think Before Coding).

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `apps/web/src/index.css` defines an `@theme inline` mapping for semantic tokens (`--color-surface`, `--color-surface-raised`, `--color-text-primary`, `--color-text-muted`, `--color-accent`, `--color-border`, `--color-danger`, `--color-success`, `--color-warning`) plus two `[data-theme="simple"]` / `[data-theme="dark-neon"]` blocks | ADR-0001 |
| 2 | All 17 files currently using raw Tailwind palette classes (`bg-slate-100`, `text-gray-700`, etc. — re-verify the exact current list via grep, don't trust a stale count) are migrated to semantic token classes (`bg-surface`, `text-primary`, etc.) | Locked scope decision (full migration in this task) |
| 3 | A `ThemeProvider` sets `data-theme` on `<html>` before first paint using a synchronously-available value (cached last-known theme), then reconciles with the account's `themePreference` once auth resolves | Edge case (flash of wrong theme) |
| 4 | Settings/profile page has a control to switch between "Simple" and "Dark Neon"; selecting one calls T025's update endpoint and updates `data-theme` immediately (optimistic) | FR-025, switcher-location decision |
| 5 | Logged-out views (e.g. login page) render with a sensible default theme (`"simple"`) with no account to read from | Edge case |
| 6 | A user with no `themePreference` ever set (or an unrecognized value) falls back to `"simple"`, never renders unstyled | Edge case |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | User selects "Dark Neon" on settings page | `<html data-theme="dark-neon">`, background/accent colors visibly change, backend call fires | live browser verify (easy-ui-mcp) |
| 2 | Page reload after selecting Dark Neon | Theme persists (read back from account via auth payload), no flash of Simple before Dark Neon applies | live browser verify |
| 3 | Grep for raw Tailwind palette color classes across `apps/web/src/**/*.tsx` | Zero matches outside the token-definition CSS itself | automated grep check in test/CI step |
| 4 | Backend returns an unrecognized theme string (simulated) | UI falls back to Simple, does not crash | automated test (unit test on the fallback logic) |
| 5 | Visit login page (logged out) | Renders in Simple theme, no console errors | live browser verify |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- theme && grep -rEn "bg-(slate|gray|indigo|zinc|neutral|amber|orange)-[0-9]+|text-(slate|gray|indigo|zinc|neutral|amber|orange)-[0-9]+" src --include=*.tsx | grep -v index.css
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is
> filled with real, pasted output — not just checked. The `verify` row's first cell must be a bare
> `| verify |` (no backticks), and its Notes cell must contain the literal word "pass" (case-insensitive).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| verify | ☐ pass / ☐ fail | |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☐ pass / ☐ fail | |
| Full smoke suite still green (no regression) | ☐ pass / ☐ fail | |
| **UI: Visual regression (diff or verdict pasted)** | ☐ pass / ☐ fail / ☐ N/A | |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☐ pass / ☐ fail / ☐ N/A | |
| **UI: Responsiveness at target viewports** | ☐ pass / ☐ fail / ☐ N/A | |

> **Evidence-archiving rule (required):** copy any external-tool artifacts (easy-ui-mcp screenshots/session reports) into `reports/evidence/T026/` and commit — reference the repo-local path in Notes, not an external path.

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Dashboard, Tasks, Inventory, Recipes, Guidelines, Notes, Settings/profile page — both themes | LLM vision via easy-ui-mcp screenshot | No unstyled/raw-palette elements visible in Dark Neon; matches Simple's existing layout in Simple |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit — grep for raw Tailwind palette classes (see Verification Command) | Zero matches in component files |
| Typography matches spec | Visual — unchanged from current (this task is color-only, not typography) | No typography regression |
| Spacing / layout matches spec | Visual — unchanged from current | No layout regression |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | easy-ui-mcp DOM assertion (per T021's documented workaround — no viewport-resize primitive) | No overflow/contrast regression in either theme |
| Tablet (768px) | easy-ui-mcp DOM assertion | No overflow/contrast regression in either theme |
| Desktop (1024px+) | Screenshot | No overflow/contrast regression in either theme |

---

## Approach

Per ADR-0001 and the locked brainstorming decision (Option B):
1. Define the semantic token set in `apps/web/src/index.css` via `@theme inline`, deriving tokens strictly from the actual current usage (re-grep the 17 files — do not invent tokens nobody consumes, per the 50% Rule Check in the brainstorming log).
2. Add `[data-theme="simple"]` (values matching current look exactly) and `[data-theme="dark-neon"]` (new palette) CSS blocks.
3. Build `ThemeProvider` (new, e.g. `apps/web/src/theme/ThemeProvider.tsx`): reads a synchronously-available cached theme (e.g. `localStorage` used only as a paint-time cache, NOT as the source of truth — the account via T025 is the source of truth) to set `data-theme` before first paint, then reconciles with the authenticated user's `themePreference` once the auth context resolves, calling T025's endpoint on user-initiated switches.
4. Migrate all 17 files: replace raw Tailwind palette classes with the new semantic classes one file at a time, verifying no visual regression in Simple theme as each is migrated (Simple's token values must reproduce today's exact look).
5. Add the switcher control to the settings/profile page (confirm actual page path in code first — grep for an existing settings/profile route, or note if one must be created as a minimal addition).

---

## Edge Case Checklist

- [ ] Flash of default/wrong theme before `themePreference` loads — solved via synchronous pre-paint cache read, not a network-wait
- [ ] Logged-out / unauthenticated views (login page) — render in Simple, no account to read from
- [ ] User has no `themePreference` ever set (T025 default covers new/migrated rows, but double-check the frontend doesn't choke on an unexpected null during the transition window)
- [ ] Unknown/invalid theme value from the backend — client falls back to `"simple"` rather than rendering unstyled
- [ ] Cross-tab consistency is explicitly NOT required for this task (deferred, documented gap) — do not build it
- [ ] Every one of the 17 migrated files re-verified visually in both themes — no missed raw-color class left behind
- [ ] Casing mismatch between frontend theme IDs (`"simple"`/`"dark-neon"`, kebab-case) and backend enum values (`simple`/`dark_neon`, snake_case) — the `ThemeProvider` must translate between them consistently at the API boundary; do not leak one format into the other's context

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/index.css` | Add `@theme inline` token mapping + two `[data-theme]` blocks |
| `apps/web/src/main.tsx` | Wire pre-paint theme initialization |
| New: `apps/web/src/theme/ThemeProvider.tsx` | Context: reads/writes theme, calls T025 endpoint |
| Settings/profile page (verify actual path) | Add theme switcher control |
| All 17 `.tsx` files currently using raw Tailwind color classes (re-grep for exact current list) | Migrate to semantic token classes |
| `apps/web` auth context | Surface `themePreference` from the logged-in user, translate casing |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**` | Backend is T025's scope, already merged — do not modify |
| Business-logic components' non-color logic (data fetching, state management) | Purely presentational change — do not refactor adjacent logic (Surgical Changes principle) |
| `RealtimeGateway` / Socket.IO handlers | No realtime dimension to a theme preference |

---

## Test Plan

Unit tests for the fallback logic (unknown theme → Simple) and the casing-translation helper. Live browser verify (easy-ui-mcp) for the visual/switcher/persistence behavior across both themes and target viewports, per the UI Evidence rows above — this cannot be fully covered by unit tests alone.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required (Low Risk) — skip per Stage 4 gating rules
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app, both themes
- [ ] All three UI Evidence rows filled with pasted evidence (Hard-Stop Gate 6)
- [ ] Any external-tool evidence (easy-ui-mcp screenshots/session reports) copied into `reports/evidence/T026/` and committed
- [ ] `memory/MEMORY.md` updated (if new patterns or feedback learned)
- [ ] Supervisor notified: task ready for Stage 4 review
