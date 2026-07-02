# TASK_GUIDE — T021: Mobile responsive pass (tablet/phone breakpoints)
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: frontend-developer
**Agent guide**: `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/frontend.md`
5. C2 task — read `memory/codebase-map.md` if present

Note: complexity is set to C2 despite Low risk because this task coordinates fixes across every previously-built screen — matches the "QA suite / structural pass" pattern in CLAUDE.md Hard-Stop Gate 2's spirit, even though it isn't a refactor.

---

## Requirement (Pillar 1 — Adapt the requirement)

Kitchen staff mostly use tablets/phones — this task is the coordinated fix pass ensuring every screen actually holds up there.

**Restated intent**:
> Every built screen (Dashboard, Tasks kanban/list, Guidelines, Inventory, Notes, Announcements) renders with zero horizontal-scroll incidents at 375px and works well at 768px — closing the gap between "responsive-ish per task" and "verified responsive end to end."

**Out of scope**:
- Any new feature — CSS/layout fixes only

**Requirement Refs**:
- NFR-005, US-011, PRD Success Metric "Mobile usability"

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Zero horizontal-scroll incidents across all listed screens at 375px width | NFR-005, PRD Success Metric |
| 2 | Kanban board is usable via tap-to-move fallback (not just drag) at phone width | US-004, US-011 |
| 3 | Long Recipe/Ingredient names do not overflow fixed-width containers | NFR-005 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Each of the 6 listed screens at 375px viewport | No page-level horizontal scrollbar | screenshot per screen, pasted in evidence |
| 2 | Kanban board at phone width | Tap-to-move works, column overflow is contained WITHIN the board, not the page | manual + screenshot |
| 3 | Recipe with a 60-character name | Truncates/wraps gracefully, no overflow | screenshot |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/web run test -- responsive
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| **UI: Visual regression** | ☐ pass / ☐ fail | before/after screenshots per screen |
| **UI: Design-system compliance** | ☐ pass / ☐ fail | |
| **UI: Responsiveness** | ☐ pass / ☐ fail | this task's entire purpose |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Dashboard, Tasks (kanban+list), Guidelines, Inventory, Notes, Announcements | MCP screenshot (Playwright MCP) at 375px each | No horizontal page scroll on any |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | No change expected — layout-only pass |
| Typography matches spec | Computed style | Text wraps/truncates instead of overflowing |
| Spacing / layout matches spec | Computed style | Consistent responsive spacing scale applied |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP), all 6 screens | Zero page-level horizontal scroll |
| Tablet (768px) | MCP screenshot (Playwright MCP), all 6 screens | Usable multi-column or stacked layout |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) spot-check | No regression from this pass |

---

## Approach

Systematic audit pass: load each of the 6 screens at 375px/768px in a device emulator, fix any overflow with CSS (max-width, text-overflow, flex-wrap) rather than restructuring components. Kanban-specific: contain horizontal scroll to the board element (`overflow-x: auto` on the board, not the page), verify tap-to-move (built in T008) still works at this width.

---

## Edge Case Checklist

- [ ] Long Recipe/Ingredient names overflowing fixed-width containers are fixed with truncation/wrapping, not layout breakage
- [ ] Kanban column overflow is contained WITHIN the board (acceptable), never at the page level (not acceptable) — explicit distinction verified per screen

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/web/src/**` (CSS/layout only) | Responsive fixes across all built screens |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/**` | No backend changes — pure frontend layout pass |
| Any component's business logic | CSS/layout fixes only, no behavior changes |

---

## Test Plan

MCP screenshot (Playwright MCP)-based visual regression at 3 breakpoints across all 6 screens; manual tap-to-move check on kanban.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Low risk)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
