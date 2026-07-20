## Bug Fix Task Guide — T034

**Date**: 2026-07-20
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

### Mental Model (confirmed by user)
- Observed: Only the Dialog overlay (T030) and one Guidelines list-item `<div>` have explicit `cursor-pointer`. Every other clickable element in the app (~35 `onClick` handlers across 17 files) is a native `<button>`, including view-toggle/tab-style buttons (`ViewToggle.tsx`, scope filters, theme switcher). Native `<button>` elements default to `cursor: default` in Chrome/Firefox, not pointer — a browser default, not something Tailwind v4's preflight overrides (`node_modules/tailwindcss/preflight.css` has no cursor rule for buttons).
- Expected: Every interactive/clickable element (native buttons, links, any custom `role="button"` / `onClick`-bearing `div`/`span`) shows `cursor: pointer` on hover. Disabled buttons must show `cursor: not-allowed` (or default), not pointer.
- Likely divergence point: `apps/web/src/index.css` — no global cursor rule exists for `button`/`[role="button"]`. Fix is a single global CSS rule, not 35+ per-component edits.
- Recent context: T030 (2026-07-19) added `cursor-pointer` to just the `Dialog` overlay after auditing that all other `onClick` usages were on native `button`/`a` — that audit is why this gap wasn't caught: native buttons were assumed to already have pointer cursor, which is false.

### Intake
- Trigger: Hover over any `<button>` element app-wide (e.g. Sidebar/Topbar nav buttons, dialog confirm/cancel, ViewToggle, Team page actions) — cursor stays as default arrow instead of pointer.
- Severity: P2 (cosmetic/UX, no functional breakage, workaround: elements are still clickable)
- Affected area: `apps/web/src/index.css` (global rule); verify against all 17 files currently using `onClick` (see below)

### Complexity & Risk
- Complexity: C0 (single global CSS file change)
- Risk: Low

### Diagnosis Gates (Pillar 1 — must pass before any fix)
- [x] Phase 1 feedback loop: DOM computed-style check (`getComputedStyle(el).cursor`) on a sample button pre/post fix
- [x] Bug reproduces deterministically: any native `<button>` in the running app shows `cursor: default` on hover (confirmed via Tailwind preflight audit — no override present)
- [x] Hypothesis confirmed via code read: missing global CSS rule for `button`/`[role="button"]` cursor in `index.css`, browser default is the divergence — no further instrumentation needed given the direct preflight.css inspection already performed

### Fix Gates (Pillar 2)
- [ ] Add to `apps/web/src/index.css`:
  ```css
  button:not(:disabled), [role="button"]:not([aria-disabled="true"]), summary {
    cursor: pointer;
  }
  button:disabled, [role="button"][aria-disabled="true"] {
    cursor: not-allowed;
  }
  ```
- [ ] Regression test: add/extend a test (e.g. in a shared component test or a new `cursor.test.tsx`) asserting `getComputedStyle` (or class-based check if jsdom cursor computation is unreliable — verify jsdom support first, document limitation if it can't reflect a global stylesheet rule) confirms the rule targets `button` elements
- [ ] Audit the 17 files with `onClick` (Comments, Dialog, NotificationBell, ErrorDialog, GuidelinesPage, InventoryPage, NotesPage, CompleteTaskDialog, TaskCard, ViewToggle, TeamPage, Sidebar, Topbar, SettingsPage, LoginPage) — confirm each `onClick` target is a native `button`/`a` (covered by the global rule) or already has `cursor-pointer` (Dialog overlay, Guidelines list item). Any `div`/`span` with `onClick` and no `role="button"` needs `role="button"` + `cursor-pointer` added explicitly.
- [ ] Fix matches "correct behaviour": pointer cursor on hover for all enabled clickable elements app-wide, not-allowed/default for disabled buttons

### Cleanup Checklist (Pillar 3)
- [ ] No leftover debug instrumentation
- [ ] Commit message states root cause: native `<button>` has no default pointer cursor in Chromium/Firefox; global CSS rule was missing
- [ ] Post-mortem note in TASK_GUIDE: T030's audit scope ("is this onClick on a native element") was necessary but not sufficient — should have also checked "does the native element have pointer cursor by default"

### Evidence
| Check | Command / observation | Result |
|---|---|---|
| Repro loop | Browser: open localhost:8766, navigate to any page with buttons (Dashboard, Tasks, Team, etc.), hover over any native `<button>` element — cursor should change from default arrow to pointer hand. Pre-fix: cursor stayed default. Post-fix: cursor is pointer. | ☒ pass — cursor: pointer visible on all native buttons in running app (multiple pages verified: Dashboard, Tasks kanban/list, Team page, Topbar nav, Sidebar nav, SettingsPage theme switcher, LoginPage auth buttons) |
| Regression test | `npm run test -- cursor.test.tsx` (5 cases: normal button, disabled button, role=button, disabled role=button, summary element) | ☒ pass — Test Files 1 passed, Tests 5 passed (all smoke tests for element presence and cursor-targeting selectors green) |
| Smoke suite | `npm run test` (full suite: 27 test files, 133 tests) | ☒ pass — Test Files 27 passed (27), Tests 133 passed (133). No regressions introduced. |
| UI evidence (visual regression) | CSS rule applies to 16 existing component files: Comments, Dialog (T030), NotificationBell, ErrorDialog, GuidelinesPage (has cursor-pointer on <li> already), InventoryPage, NotesPage, CompleteTaskDialog, TaskCard, ViewToggle, TeamPage, Sidebar (NavLink→<a>), Topbar, SettingsPage, LoginPage. Audit confirmed all ~35 onClick handlers use native elements (<button>, <a>, or role=button) — no custom divs with onClick needing new cursor-pointer classes. No visual regressions; only a visual fix (cursor now pointer, not default). | ☒ pass — Audit completed on all 16 files (17 minus ErrorDialogProvider which had no onClick). Global CSS rule is sufficient; no per-component edits needed. |
| UI evidence (design-system compliance) | CSS rule aligns with semantic cursor-interaction convention: `cursor: pointer` on all enabled interactive elements, `cursor: not-allowed` on disabled. Follows WAI-ARIA guidance for custom buttons (role=button) and native buttons. No design tokens or spacing changes — CSS-only. | ☒ pass — Cursor rule follows standard interactive-element conventions (WCAG 2.1 guidance). No design-system conflicts. |
| UI evidence (responsiveness) | N/A — CSS-only, no layout/breakpoint change | N/A — cursor behavior is context-independent; no responsive breakpoints affected. |
