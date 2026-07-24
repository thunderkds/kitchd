# TASK_GUIDE — T032: Guidelines Page (SOP List + CRUD UI)
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
5. C2: apply the Complexity matrix process from `.claude/agents/general-agent-template.md`
6. Read `memory/codebase-map.md` for directory layout

---

## Requirement (Pillar 1 — Adapt the requirement)

User request (verbatim, from a Supervisor-run investigation): "let investigate the inventory, guidelines and announcement cause they are not implemented"

**Supervisor investigation finding**: The Guidelines backend (`apps/api/src/guidelines/guidelines.controller.ts`, `@Controller('guidelines')`) is fully implemented and registered in `AppModule` — 4 routes: `GET /guidelines`, `GET /guidelines/:id`, `POST /guidelines`, `PATCH /guidelines/:id`. But `apps/web` has **zero** frontend integration for Guidelines — not even a dashboard widget (unlike Inventory/Announcements, which at least have a partial widget). The `/guidelines` nav item (`apps/web/src/layout/navigation.ts:11`) falls through in `App.tsx` to the generic `SectionPage`/`EmptyState` placeholder.

**Restated intent**:
> Build a real `/guidelines` page: list all guidelines (SOPs) with title/type, let Owner/Admin/Chef create and edit them, and let any authenticated user view a guideline's full steps/content. This closes the "Guidelines is not implemented" gap — the highest-severity of the three since it currently has no frontend at all.

**Out of scope**:
- Any backend change — the API is complete
- Wiring "generate task from this guideline" (T009's `POST /tasks/generate-from-recipe/guideline/:guidelineId` already exists as a backend capability) — a nice-to-have link/button is fine if trivial, but a full task-generation flow from this page is not required
- Guideline versioning/history UI (no such backend endpoint exists)

**Requirement Refs**: Backend delivered under T006 (Guideline CRUD, Done 2026-07-04). No PRD FR/NFR explicitly names "frontend must exist" as a separate line; Supervisor is the acceptance oracle for this frontend-completeness gap.

### Requirement Fidelity Gate (sign off BEFORE implementation)
- [x] Restated intent confirmed to match the user's request
- [x] Domain terms align — `Guideline` matches `memory/glossary.md` domain models; note the enum `type` filter caveat already recorded in `memory/learnings.md` (`?type=` query param needs explicit validation, T006-era bug — don't reintroduce an unvalidated enum filter if you add one)
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] Backend routes confirmed to exist by Supervisor's own Explore-agent investigation before this guide was written

---

## Dependencies & Reachability

**Depends on**: `None` — backend (T006) already merged and live

**Entry point**: `/guidelines` route in `apps/web/src/App.tsx` (currently falls through to `SectionPage`) — replace with a new `GuidelinesPage` component, reachable via the existing `Guidelines` sidebar nav item (`layout/navigation.ts:11`)

> **Shared-file note**: `apps/web/src/App.tsx` is being edited in parallel by sibling tasks T031 (Inventory) and T033 (Announcements). Expect a merge conflict at integration — add your `/guidelines` branch cleanly without touching other routes' lines.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `/guidelines` renders a list of all guidelines (title, type) fetched from `GET /guidelines` | "list all guidelines" |
| 2 | Clicking a guideline shows its full content/steps via `GET /guidelines/:id` | "view a guideline's full steps/content" |
| 3 | Owner/Admin/Chef see a "New Guideline" control; Staff/Viewer do not | RBAC matches backend `WRITE_ROLES = [OWNER, ADMIN, CHEF]` |
| 4 | Creating a guideline calls `POST /guidelines`, editing calls `PATCH /guidelines/:id` | "let ... create and edit them" |
| 5 | A Staff/Viewer user's fetch itself is gated the same way (no write calls attempted, not just hidden controls — same pattern as T028) | RBAC negative case |
| 6 | API errors surface through the existing global `ErrorDialogProvider`/`notifyApiError()` (T029) | Reuse existing pattern |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged in as Owner, navigate to `/guidelines` | List renders with real data | automated test + live verify |
| 2 | Click a guideline | Detail/steps view renders via `GET /guidelines/:id` | automated test |
| 3 | Logged in as Viewer | List renders, no write controls, no write API calls made | automated test |
| 4 | Owner submits new guideline form | `POST /guidelines` fires, list updates | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- Guidelines
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/guidelines/GuidelinesPage.test.tsx` — 8 tests — pass |
| Verification command run | ☒ pass | `cd apps/web && npm test -- Guidelines` → 8/8 pass — pass |
| Negative cases hold | ☒ pass | Live verify: Viewer sees list but no "New Guideline" control (`t032-viewer-guidelines.png`) — pass |
| verify | ☒ pass | Supervisor ran live Playwright verify against a real API+Postgres instance (implementer had no `.env` available): Owner created a guideline, list updated without reload, clicked through to detail view showing full steps, Viewer confirmed read-only. Screenshots archived `reports/evidence/T032/`. Full suite 110/110 green — pass |
| Review scope bounded to the change's blast radius | ☒ pass | Reviewed the 5 new/changed files (GuidelinesPage, api, types, tests, App.tsx +4 lines) — matches Files to Change table — pass |
| Full smoke suite still green (no regression) | ☒ pass | 110/110 frontend tests green post-implementation — pass |
| **UI: Visual regression** | ☒ pass | `t032-owner-guidelines-list.png`, `t032-owner-guidelines-detail.png` — matches `TeamPage`/`NotesPage` visual pattern — pass |
| **UI: Design-system compliance** | ☒ pass | `bg-surface-raised`, `text-danger`, `bg-accent`/`text-white`, `text-muted` semantic tokens, no raw hex — pass |
| **UI: Responsiveness** | ☒ pass | `t032-mobile-375.png` — no horizontal overflow at 375px — pass |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression
| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Guidelines list + detail view + form | Playwright screenshot (easy-ui-mcp unavailable) | Matches existing page patterns (`NotesPage`, `TeamPage`) |

### 2. Design-System Compliance
| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors/typography/spacing use semantic tokens | computed-style check | No raw hex/rgb, correct in both themes |

### 3. Layout / Responsiveness
| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | screenshot | No horizontal overflow |
| Tablet (768px) | screenshot | Readable |
| Desktop (1024px+) | screenshot | Capped max-width, matches other pages |

---

## Approach

1. Create `apps/web/src/features/guidelines/api.ts` mirroring `features/team/api.ts`'s `request<T>()` pattern, including T029's `notifyApiError()` wiring.
2. Create `apps/web/src/features/guidelines/GuidelinesPage.tsx` — list + detail view + create/edit form, RBAC-gated the same way `TeamPage.tsx` gates fetch + controls.
3. Wire `/guidelines` in `App.tsx` to `GuidelinesPage` (one `if` branch + one import).
4. If a `?type=` filter is added, validate it explicitly client-side before sending (matches the backend-side lesson already in `memory/learnings.md` about unvalidated enum query params).

---

## Edge Case Checklist
- [ ] Empty guideline list shows a sensible empty state
- [ ] Guideline with very long steps/content doesn't break layout
- [ ] Failed API response routes through the global error dialog

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/guidelines/api.ts` (new) | Guidelines API client |
| `apps/web/src/features/guidelines/GuidelinesPage.tsx` (new) | Main page component |
| `apps/web/src/App.tsx` | Add `/guidelines` route branch (expect merge conflict with T031/T033) |

## Files Must NOT Touch
| File | Reason |
|------|--------|
| `apps/api/**` | Backend is complete, frontend-only task |
| `apps/web/src/layout/navigation.ts` | Nav entry already exists |

---

## Test Plan
Vitest + Testing Library component tests for list/detail render, RBAC gating, create/edit flow, error-dialog integration. Live verify via Playwright.

---

## Completion Checklist
- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: not required (Risk: Low, no new backend surface)
- [ ] Lint passes
- [ ] Tests written AND pass — pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
