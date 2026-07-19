# TASK_GUIDE — T029: Global Error/Warning Dialog
**Date**: 2026-07-19
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
5. C2: apply the Complexity matrix process (decompose / verify depth / model) from `.claude/agents/general-agent-template.md`
6. Read `memory/codebase-map.md` for directory layout — this task touches every `features/*/api.ts` file, so orientation matters

---

## Requirement (Pillar 1 — Adapt the requirement)

User request (verbatim): "adding the dialog for all of warning and error message in the application"

Clarified via `AskUserQuestion` with the user:
- Presentation: **blocking modal dialog** (not toast/snackbar)
- Scope: **all API/network errors app-wide** (every failed `fetch` — 4xx/5xx and network failure — across every feature)

**Restated intent**:
> Every API/network failure anywhere in the app (currently a per-feature `throw new Error(...)` that each caller may or may not catch) surfaces to the user through one shared, consistently-styled modal dialog, instead of being silently swallowed, left as an uncaught promise rejection, or shown via inconsistent ad-hoc UI per feature.

**Out of scope** (non-goals):
- Client-side form validation errors (inline field errors stay as-is)
- Toast/snackbar notifications
- Global uncaught-JS-exception boundary (`window.onerror` / React error boundary)
- Changing 401 behavior beyond showing the dialog (no auto-redirect-to-login, no token-clear — that is a separate concern, tracked as a follow-up below)
- Consolidating the duplicated `request<T>()` helper across `features/*/api.ts` into one shared HTTP client (tempting, but out of scope — see Approach)

**Requirement Refs**: No existing PRD FR/NFR names this explicitly (closest is NFR-005 general usability). This is a net-new UX requirement added directly by the user; Supervisor is authoring the acceptance oracle below since no PRD line exists to trace against.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (forced-choice `AskUserQuestion`, both answers confirmed)
- [x] Domain terms align with `PROJECT_SPEC.md` glossary (no new domain term introduced — "error dialog" is UI-only)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] No PRD Requirement Refs to verify against (see above) — Supervisor is the oracle author

> Implementer must NOT start until it has re-read this gate and confirms no ambiguity remains.

---

## Dependencies & Reachability

**Depends on**: `None` — all target `features/*/api.ts` files already exist and merged to develop

**Entry point**: `ErrorDialogProvider` (mounted in `apps/web/src/App.tsx`) — every existing `request<T>()` call in `apps/web/src/features/*/api.ts` and `apps/web/src/components/*/api.ts` is a consumer

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | When any `features/*/api.ts` `request()` call receives a non-2xx response, a modal dialog appears showing the server's error message (or a generic fallback if none) | "surfaces ... through one shared ... modal dialog" |
| 2 | When a `fetch` call rejects outright (network failure, e.g. server unreachable), the same dialog appears with a network-failure message, not an unhandled promise rejection in the console | "API/network errors app-wide" |
| 3 | The dialog is dismissible (explicit close button and/or overlay click) and does not block re-triggering — a second error while one dialog is open updates/replaces the message rather than stacking dialogs | Modal dialog UX baseline |
| 4 | The dialog renders using existing semantic theme tokens (works correctly in both `simple` and `dark-neon` themes) | Consistency with T025/T026 theme system already in place |
| 5 | Existing per-feature `catch` blocks that show their own inline error UI (if any) continue to work — the global dialog is additive, not a replacement that breaks existing feature-level error handling | "Out of scope: changing behavior beyond showing the dialog" |
| 6 | A successful (2xx) request never triggers the dialog | Negative case |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | API call returns 400/404/500 with a JSON `{ message }` body | Dialog opens showing that message | automated test (mock fetch) + live verify |
| 2 | API call returns non-2xx with no parseable JSON body | Dialog opens showing a generic fallback message, not "undefined" | automated test |
| 3 | `fetch` itself rejects (simulated network error) | Dialog opens with a network-failure message | automated test |
| 4 | Dialog is open, user clicks close/overlay | Dialog closes, app remains usable | automated test |
| 5 | Two failures fire in quick succession | Only one dialog instance visible at a time, message reflects the latest error | automated test |
| 6 | API call returns 200 | No dialog appears | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- ErrorDialog
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/errorDialog/ErrorDialogProvider.test.tsx` (7 tests, AC1-AC6), `apps/web/src/features/tasks/api.errorDialog.test.ts`, `apps/web/src/components/Comments/api.errorDialog.test.ts`, `apps/web/src/components/LowStockWidget/api.errorDialog.test.ts` — pass |
| Verification command run | ☒ pass | `cd apps/web && npm test -- ErrorDialog` → 16 tests passed (4 files) — pass |
| Negative cases hold | ☒ pass | AC6 (2xx never triggers dialog) covered in ErrorDialogProvider.test.tsx; non-JSON body fallback message covered — pass |
| verify | ☒ pass | Live browser verify via Playwright (easy-ui-mcp unavailable, same substitution pattern as T026): logged in as seeded owner user, aborted API requests to simulate network failure, confirmed dialog renders with correct message, dismisses via Close button and stays dismissed. Screenshots archived to `reports/evidence/T029/`. Full suite `npm test -- --run` → 98 tests passed (22 files), `tsc -b --noEmit` clean, `vite build` succeeds — pass |
| Review scope bounded to the change's blast radius | ☒ pass | Reviewed the 15 changed files only (7 api.ts wiring, 3 new components, App.tsx mount, 4 new test files) — matches Files to Change table, no drift — pass |
| Full smoke suite still green (no regression) | ☒ pass | 98/98 frontend tests green post-implementation, no backend changes — pass |
| **UI: Visual regression** | ☒ pass | Screenshot comparison against `CompleteTaskDialog`'s established overlay pattern: matching overlay + centered card + role="dialog" — `reports/evidence/T029/t029-error-dialog-simple.png`, `t029-error-dialog-simpletheme.png` — pass |
| **UI: Design-system compliance** | ☒ pass | Visually confirmed `bg-surface-raised`, `text-danger`-class heading, `bg-accent` Close button correctly resolve in both `dark-neon` (`t029-error-dialog-darkneon.png`) and `simple` (`t029-error-dialog-simpletheme.png`) themes, no raw hex colors — pass |
| **UI: Responsiveness** | ☒ pass | Mobile 375px viewport screenshot (`t029-error-dialog-mobile.png`) shows dialog fits width with no horizontal overflow; desktop 1280px confirmed centered with capped max-width — pass |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `ErrorDialog` (open state, triggered from any feature page) | LLM-vision screenshot (easy-ui-mcp) or Playwright DOM assertion if MCP unavailable | Overlay + centered dialog box, matches existing `CompleteTaskDialog` visual pattern |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | computed-style / CSS audit | Uses `--color-*` semantic tokens, no raw hex/rgb; correct in both `simple` and `dark-neon` `[data-theme]` blocks |
| Typography matches spec | computed style | Matches existing dialog/modal typography (see `CompleteTaskDialog.tsx`) |
| Spacing / layout matches spec | computed style | Consistent padding/margin with `CompleteTaskDialog.tsx` |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | screenshot / DOM assertion | Dialog fits viewport width, no horizontal overflow |
| Tablet (768px) | screenshot / DOM assertion | Dialog centered, readable |
| Desktop (1024px+) | screenshot / DOM assertion | Dialog centered, capped max-width |

---

## Approach

1. Build a reusable `Dialog`/`Modal` primitive under `apps/web/src/components/Dialog/` (generalize the visual pattern already used by `features/tasks/CompleteTaskDialog/CompleteTaskDialog.tsx` — overlay + `role="dialog"` + semantic tokens — rather than inventing a new visual language).
2. Add `ErrorDialogProvider` + `useErrorDialog()` context under `apps/web/src/errorDialog/` (mirrors the existing `ThemeProvider` pattern in `apps/web/src/theme/ThemeProvider.tsx` — same repo convention for global providers). Expose an imperative `showError(message: string)` plus a plain module-level singleton function (e.g. `notifyApiError(message)`) so it's callable from `api.ts` files that are outside React component scope.
3. Mount `<ErrorDialogProvider>` in `apps/web/src/App.tsx`, wrapping `<AppRoutes />` alongside the existing `<ThemeProvider>`.
4. In each `features/*/api.ts` / `components/*/api.ts` file's shared `request<T>()` helper, call the singleton `notifyApiError(...)` in the `!res.ok` branch and in the `fetch` rejection path, then continue to `throw` as today (existing per-feature `catch` blocks are unaffected — this is additive, satisfying AC5).
5. Do **not** consolidate the duplicated `request<T>()` helpers into one shared client file — that is a separate refactor with its own blast radius across 7 files and is not what was asked. Touch only the `!res.ok` / catch branch of each existing helper.

---

## Edge Case Checklist

- [ ] No JSON body / non-JSON response → generic fallback message, not "undefined" or a stack trace
- [ ] Two errors fire back-to-back (e.g. two widgets both fail on page load) → single dialog, latest message wins, no dialog stacking
- [ ] 401 responses also trigger the dialog like any other error (explicitly no special redirect/token-clear behavior added — out of scope, flag as a tracked follow-up in Memory)
- [ ] Dialog must not trap focus permanently / must be closable via keyboard (Escape) for accessibility
- [ ] Works identically in `simple` and `dark-neon` themes

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/components/Dialog/Dialog.tsx` (new) | Reusable modal primitive |
| `apps/web/src/errorDialog/ErrorDialogProvider.tsx` (new) | Context + `useErrorDialog()` + module-level `notifyApiError()` singleton |
| `apps/web/src/errorDialog/ErrorDialog.tsx` (new) | Renders `Dialog` with error message + close |
| `apps/web/src/App.tsx` | Mount `<ErrorDialogProvider>` |
| `apps/web/src/features/tasks/api.ts` | Call `notifyApiError()` in error branch |
| `apps/web/src/features/team/api.ts` | Call `notifyApiError()` in error branch |
| `apps/web/src/features/notes/api.ts` | Call `notifyApiError()` in error branch |
| `apps/web/src/components/LowStockWidget/api.ts` | Call `notifyApiError()` in error branch |
| `apps/web/src/components/AnnouncementsWidget/api.ts` | Call `notifyApiError()` in error branch |
| `apps/web/src/components/NotificationBell/api.ts` | Call `notifyApiError()` in error branch |
| `apps/web/src/components/Comments/api.ts` | Call `notifyApiError()` in error branch |
| (any other `features/*/api.ts` / `components/*/api.ts` found at implementation time) | Same |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/web/src/features/tasks/CompleteTaskDialog/CompleteTaskDialog.tsx` | Existing feature-specific dialog — reference only, not to be refactored into the shared primitive in this task |
| `apps/web/src/routes/AuthGuard.tsx`, `apps/web/src/routes/auth.ts` | 401 redirect/token-clear behavior is explicitly out of scope |
| Any backend file under `apps/api/` | Frontend-only task |

---

## Test Plan

- Unit/component tests for `ErrorDialogProvider`/`useErrorDialog` (open/close/message-replace behavior) using Vitest + Testing Library, mocking `fetch`.
- At least one integration-style test per updated `api.ts` (or one representative + a shared helper test if the pattern is truly identical) confirming `notifyApiError()` fires on non-2xx and on network rejection.
- Live verify: trigger a real failed request in the running app (e.g. stop the API server or hit a 404 route) and confirm the dialog renders, in both themes.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required (Risk: Low)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app
- [ ] `memory/MEMORY.md` updated (new global-provider pattern + any api.ts files found beyond the predicted list)
- [ ] Supervisor notified: task ready for Stage 4 review
