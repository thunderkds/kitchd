# TASK_GUIDE — T031: Inventory Page (Ingredient + Stock CRUD UI)
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

**Supervisor investigation finding**: The Inventory backend (`apps/api/src/inventory/inventory.controller.ts`, `@Controller('ingredients')`) is fully implemented and registered in `AppModule` — 7 routes: `GET /ingredients`, `GET /ingredients/:id`, `POST /ingredients`, `PATCH /ingredients/:id`, `POST /ingredients/:id/stock/receive`, `POST /ingredients/:id/stock/movements`, `GET /ingredients/:id/stock/movements`. But `apps/web` has NO dedicated Inventory page — the `/inventory` nav item (`apps/web/src/layout/navigation.ts:12`) falls through in `App.tsx` to the generic `SectionPage`/`EmptyState` placeholder. The only existing frontend integration is `apps/web/src/components/LowStockWidget/` — a small read-only Dashboard widget that only calls the low-stock alerts subset, not full CRUD.

**Restated intent**:
> Build a real `/inventory` page: list all ingredients with current stock levels, let Owner/Admin/Chef create new ingredients, edit existing ones, and record stock receipts/movements. Viewers and Staff can view but not write (matches backend RBAC). This closes the "Inventory is not implemented" gap the user reported.

**Out of scope**:
- Changing `LowStockWidget` or the Dashboard — it can keep using its own scoped alert-fetching, no need to consolidate
- Any backend change — the API is complete, this is frontend-only
- CSV export UI (T020 already built export endpoints separately; not part of this page unless trivial to link)

**Requirement Refs**: Backend was delivered under T004 (`PROJECT_KANBAN.md` — Ingredient CRUD + StockBatch + StockMovement ledger, Done 2026-07-03). No PRD FR/NFR ID directly names "frontend must exist" as a separate line, but PRD's Inventory user stories implicitly require a UI — Supervisor is the acceptance oracle for the frontend-completeness gap itself.

### Requirement Fidelity Gate (sign off BEFORE implementation)
- [x] Restated intent confirmed to match the user's request
- [x] Domain terms align — Ingredient/StockBatch/StockMovement match `memory/glossary.md` domain models
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] Backend routes confirmed to exist by Supervisor's own Explore-agent investigation before this guide was written

---

## Dependencies & Reachability

**Depends on**: `None` — backend (T004) already merged and live

**Entry point**: `/inventory` route in `apps/web/src/App.tsx` (currently falls through to `SectionPage`) — replace with a new `InventoryPage` component, reachable via the existing `Inventory` sidebar nav item (`layout/navigation.ts:12`)

> **Shared-file note**: `apps/web/src/App.tsx` is being edited in parallel by sibling tasks T032 (Guidelines) and T033 (Announcements), each adding their own `if (item.path === '/x')` branch + import line. Expect a merge conflict at integration time — this is expected (same pattern as prior parallel dispatches T010/T017/T020/T021/T023, see `memory/learnings.md`). Add your branch cleanly without touching other routes' lines so the Supervisor can resolve the conflict mechanically.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `/inventory` renders a list of all ingredients (name, current stock, unit, cost) fetched from `GET /ingredients` | "list all ingredients with current stock levels" |
| 2 | Owner/Admin/Chef see an "Add Ingredient" control; Staff/Viewer do not | RBAC matches backend `WRITE_ROLES = [OWNER, ADMIN, CHEF]` |
| 3 | Creating an ingredient calls `POST /ingredients` and the new item appears in the list without a full page reload | "let ... create new ingredients" |
| 4 | Editing an ingredient calls `PATCH /ingredients/:id` | "edit existing ones" |
| 5 | Recording a stock receipt calls `POST /ingredients/:id/stock/receive` (or the movements endpoint if receipt-specific UI is out of scope for this pass — implementer's call, document which) | "record stock receipts/movements" |
| 6 | A Staff or Viewer user attempting a write action gets no write UI rendered (fetch itself must also be gated the same way T028 gated its own fetch — see `decisions.md` T028 entry) | RBAC negative case |
| 7 | API errors surface through the existing global `ErrorDialogProvider`/`notifyApiError()` (T029) — do not build a separate error UI | Reuse existing pattern, no duplicate error handling |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged in as Owner, navigate to `/inventory` | Ingredient list renders with real data | automated test + live verify |
| 2 | Logged in as Viewer, navigate to `/inventory` | List renders, no Add/Edit controls, no write API calls made | automated test |
| 3 | Owner submits new ingredient form | `POST /ingredients` fires, list updates | automated test |
| 4 | API call fails (mocked 500) | Global error dialog appears, not a page crash | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- Inventory
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/inventory/InventoryPage.test.tsx` — 9 tests covering AC1-AC7 + edge cases — pass |
| Verification command run | ☒ pass | `cd apps/web && npm test -- Inventory` → 9/9 pass — pass |
| Negative cases hold | ☒ pass | Viewer sees 0 write controls in both automated test and live Playwright verify (real invite/accept flow) — pass |
| verify | ☒ pass | Implementer ran live E2E via Playwright against a real API+Postgres instance: Owner signup → create ingredient → appears without reload → receive stock → balance updates; Viewer confirmed read-only. Screenshots archived `reports/evidence/T031/`. Supervisor re-ran full suite: 111/111 tests green — pass |
| Review scope bounded to the change's blast radius | ☒ pass | Reviewed the 6 new/changed files only (InventoryPage, api, types, tests, App.tsx +4 lines) — matches Files to Change table — pass |
| Full smoke suite still green (no regression) | ☒ pass | 111/111 frontend tests green post-implementation — pass |
| **UI: Visual regression** | ☒ pass | `reports/evidence/T031/t031_owner_inventory.png`, `t031_viewer_inventory.png` — matches existing page patterns, semantic tokens — pass |
| **UI: Design-system compliance** | ☒ pass | `bg-surface-raised`, `text-danger`, `bg-accent`/`text-white`, `text-muted` — all existing semantic tokens, no raw hex — pass |
| **UI: Responsiveness** | ☒ pass | `t031_mobile-375.png`, `t031_tablet-768.png`, `t031_desktop-1280.png` — no overflow at any breakpoint — pass |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression
| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Inventory list + add/edit forms | LLM-vision screenshot or Playwright DOM assertion (easy-ui-mcp unavailable per memory — use Playwright like T026/T029) | Matches existing page patterns (e.g. `NotesPage`, `TeamPage`) |

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

1. Create `apps/web/src/features/inventory/api.ts` mirroring the `request<T>()` pattern used in `features/tasks/api.ts` / `features/team/api.ts` (including the T029 `notifyApiError()` wiring — copy that pattern, don't invent a new one).
2. Create `apps/web/src/features/inventory/InventoryPage.tsx` — list + add/edit form, RBAC-gated the same way `TeamPage.tsx` gates its own fetch and controls (see `decisions.md` T028 entry: "fetch itself gated on canManage, not just rendered controls").
3. Wire `/inventory` in `App.tsx` to `InventoryPage` (adds one `if` branch + one import, same shape as the `/team` branch).
4. Reuse existing components where sensible (e.g. any shared form/input styling already established by `NotesPage`/`TeamPage`).

---

## Edge Case Checklist
- [ ] Empty ingredient list (no data yet) shows a sensible empty state, not a blank page
- [ ] Negative/zero stock values render without crashing
- [ ] Non-JSON or failed API response routes through the global error dialog, not a local crash

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/inventory/api.ts` (new) | Ingredient/stock API client |
| `apps/web/src/features/inventory/InventoryPage.tsx` (new) | Main page component |
| `apps/web/src/App.tsx` | Add `/inventory` route branch (expect merge conflict with T032/T033) |

## Files Must NOT Touch
| File | Reason |
|------|--------|
| `apps/api/**` | Backend is complete, frontend-only task |
| `apps/web/src/components/LowStockWidget/**` | Separate, already-working widget — leave as-is |
| `apps/web/src/layout/navigation.ts` | Nav entry already exists, no change needed |

---

## Test Plan
Vitest + Testing Library component tests for list render, RBAC gating, create/edit flow, and error-dialog integration. Live verify via Playwright (per T026/T029 pattern) since easy-ui-mcp is unavailable.

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
