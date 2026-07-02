# TASK_GUIDE — T012: Notes CRUD, tagging, pin, link-to-entity, search
**Date**: 2026-07-02
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C1 task — codebase-map read not required

---

## Requirement (Pillar 1 — Adapt the requirement)

Build quick, freeform notes — standalone or linked, searchable.

**Restated intent**:
> Any team member can create a Note (optionally linked to a Recipe/Task/Ingredient), tag it, pin it, and search across My Notes / Team Notes.

**Out of scope**:
- Frontend rich-text editor polish beyond basic markdown
- Comments (T015) — Notes and Comments are distinct entities

**Requirement Refs**:
- FR-015, FR-016, FR-017
- US-009

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md` (Note)
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A Note can be created standalone or linked to a Recipe/Task/Ingredient id | FR-015 |
| 2 | Searching a tag returns matching Notes | FR-016 |
| 3 | My Notes view excludes other users' unshared notes; Team Notes shows all | FR-017 |
| 4 | Pin/unpin toggles a Note's pinned state | FR-015 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Create a Note with linked_entity = Task:123 | Note stored with correct link | automated test |
| 2 | Search tag "#recipe-idea" | Only tagged Notes returned | automated test |
| 3 | User A's My Notes vs Team Notes | My Notes = author-scoped only, Team Notes = all | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- notes
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
| **UI: Visual regression** | ☐ pass / ☐ fail | Notes list + editor screenshot |
| **UI: Design-system compliance** | ☐ pass / ☐ fail | |
| **UI: Responsiveness** | ☐ pass / ☐ fail | |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Notes list (My/Team toggle) | MCP screenshot (Playwright MCP) | Pinned notes surfaced first |
| Note editor | MCP screenshot (Playwright MCP) | Title + markdown body + tag input |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | CSS audit | Consistent with shell |
| Typography matches spec | Computed style | Markdown body renders readably |
| Spacing / layout matches spec | Computed style | Consistent list spacing |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | MCP screenshot (Playwright MCP) | Single-column list, no overflow |
| Tablet (768px) | MCP screenshot (Playwright MCP) | List + editor usable |
| Desktop (1024px+) | MCP screenshot (Playwright MCP) | List + editor, possibly side-by-side |

---

## Approach

Note module under `/apps/api/src/notes`, full-text search via Postgres `tsvector`/`ILIKE` (simple approach sufficient for MVP scale). linked_entity is a polymorphic (type, id) pair, validated against known entity types (recipe/task/ingredient) at write time.

---

## Edge Case Checklist

- [ ] Search query with special characters doesn't break the query (parameterized, not string-concatenated)
- [ ] linked_entity pointing to a since-deleted Recipe/Task doesn't crash on load — shows "linked item no longer exists"

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/notes/**` | Note module |
| `/apps/web/src/features/notes/**` | Notes list, editor, search |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/comments` | Distinct entity, doesn't exist yet (T015) |

---

## Test Plan

Automated CRUD + search + My/Team scoping tests; manual check of linked-entity display with a deleted target.

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
