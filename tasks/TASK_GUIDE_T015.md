# TASK_GUIDE — T015: Comments component (reusable) + @mentions
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C2 task — read `memory/codebase-map.md` if present

---

## Requirement (Pillar 1 — Adapt the requirement)

Build a single reusable comment thread attachable to any of Recipe/Task/Ingredient, with working @mentions.

**Restated intent**:
> Team members can leave threaded comments on a Recipe, Task, or Ingredient; @mentioning a fellow Kitchen member resolves to their user id and triggers a notification (consumed by T016).

**Out of scope**:
- Notification delivery/bell UI itself (T016)
- Realtime push of new comments (T017)

**Requirement Refs**:
- FR-013, FR-014
- US-008

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Comment)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Posting a Comment on a Task with "@username" creates a mentions[] entry resolving to that user's id, only if they're a Kitchen member | FR-013, FR-014 |
| 2 | A comment thread on a Recipe is independent from one on a Task (entity_type+entity_id scoping) | FR-013 |
| 3 | @mentioning a non-member of the Kitchen does not resolve/notify | BRAINSTORMING_LOG.md edge case |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Comment "@bob please check" where bob is a Kitchen member | mentions=[bob's id] | automated test |
| 2 | Comment "@stranger" where stranger isn't a Kitchen member | mentions=[] (not resolved) | automated test |
| 3 | Comments on Recipe:1 vs Task:1 | Two independent threads | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- comments && npm --prefix apps/web run test -- comments
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
| **UI: Visual regression** | ☐ pass / ☐ fail | Comments component screenshot |
| **UI: Design-system compliance** | ☐ pass / ☐ fail | |
| **UI: Responsiveness** | ☐ pass / ☐ fail | |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Comments component (embedded on Recipe/Task/Ingredient detail) | MCP screenshot (Playwright MCP) | Thread list + input box, @mention autocomplete shown |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Mention chips visually distinct |
| Typography matches spec | Computed style | Consistent with shell |
| Spacing / layout matches spec | Computed style | Comfortable touch target for reply/mention actions |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Full-width thread, input pinned to bottom or inline |
| Tablet (768px) | MCP screenshot (Playwright MCP) | Comments panel fits detail view |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | Comments panel fits detail view |

---

## Approach

Comment module under `/apps/api/src/comments`, polymorphic on (entity_type, entity_id). @mention parsing: regex-extract `@username` tokens, resolve each against the current Kitchen's membership list only (never cross-Kitchen), silently drop unresolved mentions rather than erroring the whole comment. Reusable `<Comments entityType entityId />` frontend component mounted on Recipe/Task/Ingredient detail pages.

---

## Edge Case Checklist

- [ ] @mentioning a user not in the Kitchen does not resolve/notify (silently ignored, comment still posts)
- [ ] Reply threading depth: flat or single-level nesting only for MVP (document the choice, avoid unbounded recursion)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/comments/**` | Comment module, mention resolution |
| `/apps/web/src/components/Comments/**` | Reusable Comments component |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/notifications` | T016's scope — this task only emits the mention event |

---

## Test Plan

Automated tests for mention resolution (member vs non-member), entity-type scoping isolation, cross-Kitchen isolation.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Medium risk, judgment call — cross-tenant mention leakage is the main concern, covered by tests above)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
