# TASK_GUIDE — T033: Announcements Page (Broadcast + Read Receipts UI)
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

**Supervisor investigation finding**: The Announcements backend (`apps/api/src/announcements/announcements.controller.ts`, `@Controller('announcements')`) is fully implemented and registered in `AppModule` — 3 routes: `GET /announcements`, `GET /announcements/:id`, `POST /announcements`. The only existing frontend integration is `apps/web/src/components/AnnouncementsWidget/` — a small read-only Dashboard widget that calls the list endpoint. The `/announcements` nav item (`apps/web/src/layout/navigation.ts:14`) falls through in `App.tsx` to the generic `SectionPage`/`EmptyState` placeholder — there is no dedicated page to broadcast a new announcement or see full read-receipt detail.

**Restated intent**:
> Build a real `/announcements` page: list all announcements (full history, not just the Dashboard widget's subset), let Owner/Chef broadcast a new announcement, and show read-receipt status. This closes the "Announcements is not implemented" gap.

**Out of scope**:
- Changing `AnnouncementsWidget` or the Dashboard — it can keep its own scoped fetch, no need to consolidate
- Any backend change — the API is complete
- Push notifications / external delivery — this is in-app only, matching the existing backend scope

**Requirement Refs**: Backend delivered under T013 (Announcements broadcast + read receipts, Done 2026-07-05). Announcement write RBAC is `Owner/Chef only, Admin excluded` per `memory/decisions.md` T013 entry — narrower than Inventory/Guidelines, don't copy their RBAC shape. No PRD FR/NFR explicitly names "frontend must exist" as a separate line; Supervisor is the acceptance oracle for this frontend-completeness gap.

### Requirement Fidelity Gate (sign off BEFORE implementation)
- [x] Restated intent confirmed to match the user's request
- [x] Domain terms align — `Announcement` matches `memory/glossary.md` domain models
- [x] Every Acceptance Criterion below traces to the Requirement
- [x] Backend routes confirmed to exist by Supervisor's own Explore-agent investigation before this guide was written
- [x] RBAC shape explicitly re-checked against `memory/decisions.md` (Owner/Chef only — NOT the same as Inventory/Guidelines' Owner/Admin/Chef) per the standing lesson "always read each entity's own PRD/decision, never copy a prior task's RBAC shape"

---

## Dependencies & Reachability

**Depends on**: `None` — backend (T013) already merged and live

**Entry point**: `/announcements` route in `apps/web/src/App.tsx` (currently falls through to `SectionPage`) — replace with a new `AnnouncementsPage` component, reachable via the existing `Announcements` sidebar nav item (`layout/navigation.ts:14`)

> **Shared-file note**: `apps/web/src/App.tsx` is being edited in parallel by sibling tasks T031 (Inventory) and T032 (Guidelines). Expect a merge conflict at integration — add your `/announcements` branch cleanly without touching other routes' lines.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `/announcements` renders the full announcement history fetched from `GET /announcements` | "list all announcements (full history)" |
| 2 | Owner/Chef (NOT Admin) see a "New Announcement" control; Admin/Staff/Viewer do not | RBAC matches backend `WRITE_ROLES = [OWNER, CHEF]` — Admin explicitly excluded, this is the deliberate check against copying Inventory/Guidelines' broader RBAC |
| 3 | Broadcasting calls `POST /announcements` and the new item appears in the list without a full page reload | "let Owner/Chef broadcast a new announcement" |
| 4 | Read-receipt status (who has read it) is visible per announcement if the backend response includes it | "show read-receipt status" |
| 5 | An Admin, Staff, or Viewer user's fetch itself is gated the same way (no write calls attempted, not just hidden controls) | RBAC negative case |
| 6 | API errors surface through the existing global `ErrorDialogProvider`/`notifyApiError()` (T029) | Reuse existing pattern |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Logged in as Owner, navigate to `/announcements` | Full history renders | automated test + live verify |
| 2 | Logged in as Admin | List renders, NO write controls (Admin excluded per T013 RBAC), no write API calls made | automated test — this is the key negative case distinguishing this page from Inventory/Guidelines |
| 3 | Owner submits new announcement | `POST /announcements` fires, list updates | automated test |
| 4 | Logged in as Chef | Write controls ARE visible (Chef included) | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/web && npm test -- Announcements
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/web/src/features/announcements/AnnouncementsPage.test.tsx` — 9 tests — pass |
| Verification command run | ☒ pass | `cd apps/web && npm test -- Announcements` → 12/12 pass (2 files) — pass |
| Negative cases hold | ☒ pass | Live verify: Admin/Staff never see the broadcast form, list still renders (`t033-staff-announcements.png`); Chef (included) does see it — pass |
| verify | ☒ pass | Supervisor ran live Playwright verify — **found and fixed a real P1 bug during this pass**: the Broadcast button used `bg-primary text-on-primary`, an undefined token combo that rendered the label invisible (same color as its own background in both themes). Fixed to `bg-accent text-white`, matching T031/T032's established convention. Re-verified live: POST 201, announcement appears in list without reload, button now visibly readable (`t033-owner-announcements.png`). Full suite 111/111 green — pass |
| Review scope bounded to the change's blast radius | ☒ pass | Reviewed the 5 new/changed files (AnnouncementsPage, api, types, tests, App.tsx +4 lines) plus the one-line Stage-4 fix — matches Files to Change table — pass |
| Full smoke suite still green (no regression) | ☒ pass | 111/111 frontend tests green post-fix — pass |
| **UI: Visual regression** | ☒ pass | `t033-owner-announcements.png` (post-fix, button readable), `t033-staff-announcements.png` — pass |
| **UI: Design-system compliance** | ☒ pass | Fixed to `bg-accent`/`text-white` (established convention); `text-primary`, `text-muted`, `bg-surface-raised` elsewhere all valid existing tokens — pass |
| **UI: Responsiveness** | ☒ pass | `t033-mobile-375.png` — no horizontal overflow at 375px — pass |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression
| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| Announcements list + broadcast form | Playwright screenshot (easy-ui-mcp unavailable) | Matches existing page patterns |

### 2. Design-System Compliance
| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors/typography/spacing use semantic tokens | computed-style check | No raw hex/rgb, correct in both themes |

### 3. Layout / Responsiveness
| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | screenshot | No horizontal overflow |
| Tablet (768px) | screenshot | Readable |
| Desktop (1024px+) | screenshot | Capped max-width |

---

## Approach

1. Create `apps/web/src/features/announcements/api.ts` mirroring `features/team/api.ts`'s `request<T>()` pattern (T029 `notifyApiError()` wiring included). Note `components/AnnouncementsWidget/api.ts` already has a partial read-only client — check it for the response shape but build this page's own full client rather than importing the widget's scoped one.
2. Create `apps/web/src/features/announcements/AnnouncementsPage.tsx` — full list + broadcast form, RBAC-gated to `[OWNER, CHEF]` only (verify this against the live `WRITE_ROLES` constant in `apps/api/src/announcements/announcements.controller.ts` at implementation time, don't hardcode from memory alone).
3. Wire `/announcements` in `App.tsx` to `AnnouncementsPage` (one `if` branch + one import).

---

## Edge Case Checklist
- [ ] Empty announcement list shows a sensible empty state
- [ ] Admin user (in the RBAC gap, no announcement RBAC path per `memory/learnings.md` "ADMIN role has no creation path anywhere") sees read-only view correctly, no broken UI
- [ ] Failed API response routes through the global error dialog

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/web/src/features/announcements/api.ts` (new) | Announcements API client |
| `apps/web/src/features/announcements/AnnouncementsPage.tsx` (new) | Main page component |
| `apps/web/src/App.tsx` | Add `/announcements` route branch (expect merge conflict with T031/T032) |

## Files Must NOT Touch
| File | Reason |
|------|--------|
| `apps/api/**` | Backend is complete, frontend-only task |
| `apps/web/src/components/AnnouncementsWidget/**` | Separate, already-working widget — leave as-is |
| `apps/web/src/layout/navigation.ts` | Nav entry already exists |

---

## Test Plan
Vitest + Testing Library component tests for list render, the Owner/Chef-only (Admin-excluded) RBAC gating, broadcast flow, error-dialog integration. Live verify via Playwright.

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
