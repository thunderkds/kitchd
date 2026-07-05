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

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

**Pasted output (verification command, run 2026-07-05):**

```
> @kitchenos/api@0.0.1 test
> jest comments

PASS src/comments/comments.e2e.spec.ts
  Comments (e2e)
    ✓ AC1: @mentioning a Kitchen member resolves to their user id (267 ms)
    ✓ AC3: @mentioning a non-member does not resolve (mentions stays empty, comment still posts) (68 ms)
    ✓ Cross-tenant: @mentioning a same-username user from a DIFFERENT Kitchen does not resolve (218 ms)
    ✓ AC2: a comment thread on one Task is independent from another Task (entityType+entityId scoping), and also independent across entity types (83 ms)
    ✓ rejects an unknown entityType (56 ms)
    ✓ Viewer cannot create a Comment (403) (161 ms)
    ✓ Staff CAN create a Comment (per FR-018) (168 ms)
    ✓ single-level reply threading: a reply resolves under its parent, replying-to-a-reply is rejected (81 ms)
    ✓ a comment on a since-deleted Task loads without crashing (no FK, informational back-reference) (64 ms)
    ✓ only the author may delete their own Comment (403 for others) (168 ms)
    ✓ Cross-tenant: a user from another Kitchen gets 404 reading another Kitchen comment thread by id lookup path is not exposed, but delete is 404 (114 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total

> @kitchenos/web@0.0.0 test
> vitest run comments

 RUN  v4.1.9 apps/web
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**Full smoke suite (run 2026-07-05):**

```
API: Test Suites: 18 passed, 18 total / Tests: 142 passed, 142 total
Web: Test Files  8 passed (8) / Tests  37 passed (37)
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/api/src/comments/comments.e2e.spec.ts` (11 tests: AC1 mention resolves, AC3 non-member mention silently dropped, cross-tenant mention non-resolution, AC2 entityType+entityId thread scoping, unknown entityType rejected, Viewer 403, Staff allowed, single-level reply threading + reply-to-reply rejected, informational back-reference survives entity delete, author-only delete, cross-tenant 404) + `apps/web/src/components/Comments/Comments.test.tsx` (6 tests: list render, empty state, error state, mention chips, single-level reply render, submit reloads thread). All 17 pass. |
| Verification command run | pass | `npm --prefix apps/api run test -- comments && npm --prefix apps/web run test -- comments` — see pasted output below. |
| Negative cases hold | pass | Non-member @mention silently dropped (comment still posts, AC3); cross-Kitchen same-username mention does NOT resolve (main security-sensitive case); unknown entityType → 400; Viewer → 403; reply-to-a-reply → 400; cross-tenant delete → 404. |
| verify | pass | PASS — see `Skill({ skill: "verify" })` note below; ran both suites end-to-end against the live Postgres instance (docker-compose, kitchenos-postgres), migration applied, full API + web smoke suites green. Supervisor-driven independent live API session (separate live server instance): Owner posts a comment mentioning their own username → mentions resolved to own id; single-level reply posted successfully; reply-to-that-reply → 400 (threading depth enforced); comment mentioning a nonexistent user → 201 with mentions: [] (silently dropped, not erroring). Archived to `reports/evidence/T015/verify-api-session.txt`. |
| Review scope bounded to blast radius | pass | Change is additive: new `apps/api/src/comments/**` module, new `apps/web/src/components/Comments/**` component, one new Prisma model + migration, one-line registration in `app.module.ts`. No existing files' behavior changed. |
| Full smoke suite still green | pass | API: `npm --prefix apps/api run test` → 18 suites / 142 tests passed. Web: `npm --prefix apps/web run test` → 8 files / 37 tests passed. |
| **UI: Visual regression** | ☐ N/A | No Recipe/Task/Ingredient detail page exists yet to mount `<Comments />` on (same gap T007's LowStockWidget hit — see Supervisor scope correction above). Component is standalone/host-page-agnostic; needs re-verification once a real detail page exists. |
| **UI: Design-system compliance** | ☐ N/A | Same reason — no live host page/viewport to audit computed styles against yet; component reuses the same Tailwind utility classes and card/list treatment as LowStockWidget for consistency. |
| **UI: Responsiveness** | ☐ N/A | Same reason — no host page/viewport exists yet; component uses `w-full` layout with no fixed widths so it should reflow, but this is unverified until mounted. |

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

Comment module under `/apps/api/src/comments`, polymorphic on (entity_type, entity_id). @mention parsing: regex-extract `@username` tokens, resolve each against the current Kitchen's membership list only (never cross-Kitchen), silently drop unresolved mentions rather than erroring the whole comment. Reusable `<Comments entityType entityId />` frontend component.

**Scope correction (2026-07-05, Supervisor)**: no Recipe/Task/Ingredient *detail* page exists yet in this codebase (Inventory/Recipes/Guidelines render via a generic SectionPage placeholder from T003; Tasks has only the kanban/list view, no per-task detail page) — same gap as T007's LowStockWidget/T018's Dashboard. Build `<Comments entityType entityId />` as a standalone, host-page-agnostic component (like T007's LowStockWidget) — do NOT build new detail pages, that's out of scope. UI evidence for visual/design/responsiveness may be N/A-justified the same way T007's was, with a note that it needs re-verification once a real detail page exists to mount it on.

---

## Edge Case Checklist

- [x] @mentioning a user not in the Kitchen does not resolve/notify (silently ignored, comment still posts) — covered by AC3 test
- [x] Reply threading depth: flat or single-level nesting only for MVP (document the choice, avoid unbounded recursion) — enforced in `CommentsService#create` (a reply's parent must itself have `parentId === null`; replying to a reply is rejected with 400), documented in schema.prisma Comment doc-comment and comments.service.ts

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

- [x] Implementation done
- [x] Self-review: `Skill({ skill: "code-review" })` run — 0 P0/P1/P2/P3
- [x] Security review: `Skill({ skill: "security-review" })` run — 0 HIGH/MEDIUM findings; cross-tenant mention leakage specifically examined and confirmed scoped correctly
- [x] Lint passes — `npm --prefix apps/api run lint` (0 errors, auto-fix only), `npm --prefix apps/web run lint` (oxlint, clean)
- [x] Tests written AND pass — output pasted into Evidence table
- [x] `Skill({ skill: "verify" })` run — independent live API session confirms mention resolution, threading depth, and unresolved-mention edge cases
- [x] Migration-safety gate: GO (pure additive CREATE TABLE, no data-loss risk)
- [ ] `memory/MEMORY.md` updated — next: Supervisor diff-driven pass
- [x] Supervisor notified: task ready for Stage 4 review
