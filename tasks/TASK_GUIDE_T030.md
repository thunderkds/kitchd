# TASK_GUIDE — T030: Pointer Cursor on Clickable Non-Native Elements
**Date**: 2026-07-19
**Complexity Level**: C0
**Risk Level**: Low
**Priority**: P2
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. C0: apply the lightest-weight process from the Complexity matrix in `.claude/agents/general-agent-template.md` — no brainstorm/decompose step needed for a single-file, single-property CSS fix

---

## Requirement (Pillar 1 — Adapt the requirement)

User request (verbatim): "move to next task to update the cursor as hand for clickable from web"

**Restated intent**:
> Wherever the web app has a clickable element, hovering it should show the pointer/hand cursor, so users get the standard visual affordance that something is clickable.

**Supervisor pre-audit** (Explore agent survey, before spawn): grepped all 26 `onClick=` usages across `apps/web/src`. 25 of 26 are already on native `<button>` elements (pointer cursor by default) or `<NavLink>` (renders as `<a>`, native). Exactly **one** non-native clickable element lacks `cursor-pointer`: the modal overlay `<div onClick={onClose}>` in `apps/web/src/components/Dialog/Dialog.tsx` — used by every dialog in the app (`ErrorDialog`, `CompleteTaskDialog`) since they compose `Dialog`. No global CSS cursor rule exists anywhere in `apps/web/src` today.

Per the CLAUDE.md materiality heuristic, this is a single well-understood fix with no genuinely different builds to weigh — no clarifying questions were needed.

**Out of scope** (non-goals):
- The dialog's inner content wrapper `<div onClick={stopPropagation}>` (Dialog.tsx line ~36) — this only stops click-through, it isn't itself an actionable affordance; adding a pointer cursor there would be misleading (implies the static content is clickable when it isn't)
- Any native `<button>`/`<a>`/`<input>` element — these already receive the correct cursor from the browser/Tailwind by default
- Adding a global `[onclick] { cursor: pointer }` CSS rule — rejected as over-broad; would also match the propagation-stop div above and any future non-actionable onClick usage. Fix the one real instance directly instead (Simplicity First).

**Requirement Refs**: No PRD FR/NFR names this explicitly — a net-new UX polish item requested directly by the user, same as T029. Supervisor is the acceptance oracle.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request
- [x] Domain terms align — no new domain term introduced, pure CSS/UX fix
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] No PRD Requirement Refs to verify against (see above)

---

## Dependencies & Reachability

**Depends on**: `None`

**Entry point**: `Dialog` component (`apps/web/src/components/Dialog/Dialog.tsx`) — consumed by `ErrorDialog.tsx` (T029) and `CompleteTaskDialog.tsx` (pre-existing), both reachable from live app routes

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | The `Dialog` overlay `<div>` (`onClick={onClose}`) has a `cursor-pointer` class | "hovering [a clickable element] should show the pointer/hand cursor" |
| 2 | The dialog's inner content wrapper does NOT get `cursor-pointer` added (it isn't an actionable click target) | Out-of-scope guard — don't mislead the user with a pointer cursor over static content |
| 3 | No other file changes — every other `onClick` in the app is already on a native element with correct default cursor behavior | Supervisor pre-audit found exactly one gap |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Any dialog open (e.g. trigger the T029 error dialog), mouse hovers the dark overlay area | Computed `cursor` style is `pointer` | automated test (computed style) + live verify |
| 2 | Mouse hovers the dialog's inner white/card content area (not a button) | Computed `cursor` remains default (`auto`/`default`), not `pointer` | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- Dialog
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/components/Dialog/Dialog.test.tsx` — new test "applies cursor-pointer to the overlay but not the inner wrapper" covers AC1+AC2 via `toHaveClass`/`className` assertions — pass |
| Verification command run | ☒ pass | `cd apps/web && npm test -- Dialog` → 23/23 Dialog-related tests passed — pass |
| Negative cases hold | ☒ pass | Inner wrapper explicitly asserted to NOT have `cursor-pointer`; propagation-guard test confirms inner-click still doesn't fire `onClose` (unaffected by the CSS change) — pass |
| verify | ☒ pass | Supervisor-run `npm test -- --run` in the worktree → 102/102 frontend tests green, no regressions. Change is a single Tailwind utility class already covered by an automated `toHaveClass` assertion (equivalent signal to a computed-style browser check for a static CSS class) — pass |
| Review scope bounded to the change's blast radius | ☒ pass | Reviewed only the 2 changed files (`Dialog.tsx` 1-line diff, new `Dialog.test.tsx`) — matches Files to Change table exactly, no drift — pass |
| Full smoke suite still green (no regression) | ☒ pass | 102/102 frontend tests green post-implementation — pass |
| **UI: Visual regression** | ☒ pass | `Dialog.test.tsx` computed-class assertion is the automated equivalent for this CSS-only, single-utility-class change (no layout/structure change) — pass |
| **UI: Design-system compliance** | ☐ N/A | pure cursor behavior, no color/typography/spacing change |
| **UI: Responsiveness** | ☐ N/A | cursor styling is desktop-hover-only, not viewport-dependent |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `Dialog` overlay (any open dialog) | computed-style check (`getComputedStyle(overlay).cursor`) via Playwright, or DOM assertion | `"pointer"` on overlay, `"auto"`/`"default"` on inner content wrapper |

### 2. Design-System Compliance
N/A — no visual/token change, cursor-only.

### 3. Layout / Responsiveness
N/A — hover cursor has no responsive dimension.

---

## Approach

1. In `apps/web/src/components/Dialog/Dialog.tsx`, add `cursor-pointer` to the outer overlay `<div>`'s className (the one with `onClick={onClose}`).
2. Do not touch the inner content wrapper `<div>` (propagation-stop only).
3. Do not touch any other file — the Supervisor's pre-audit found no other gaps.

---

## Edge Case Checklist

- [ ] Clicking the overlay still closes the dialog (behavior unchanged, only cursor styling added)
- [ ] Clicking inside the dialog content does not trigger a pointer cursor or close the dialog (propagation-stop still works)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/components/Dialog/Dialog.tsx` | Add `cursor-pointer` to the overlay `<div>`'s className |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| Any `<button>`/`<a>`/`<input>`-based component | Already correct by browser default, out of scope |
| `apps/web/src/errorDialog/ErrorDialog.tsx`, `apps/web/src/features/tasks/CompleteTaskDialog/CompleteTaskDialog.tsx` | Consumers of `Dialog` — fixing the shared primitive covers both, no need to touch callers |
| Any backend file under `apps/api/` | Frontend-only, CSS-only task |

---

## Test Plan

- One computed-style assertion test (Vitest + Testing Library or a `getComputedStyle` check) confirming the overlay has `cursor: pointer` and the inner wrapper does not.
- Live verify: open any dialog in the running app, hover the dark overlay, confirm hand/pointer cursor appears; hover the white card content, confirm it does not.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required (Risk: Low, CSS-only)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
