# PROJECT_KANBAN.md
**Last updated**: 2026-07-06

> Compact task board. Full context lives in `PROJECT_SPEC.md`. Update this file whenever a task status changes.

---

## Board

> Task line format: **Txxx** — [title] | [agent] | C[0–3] | Risk: Low/Med/High | P[0–2]

### Todo
- [ ] **T022** — QA pass + seed demo data + onboarding walkthrough | qa-expert | C2 | Risk: Med | P0

### In Progress

### Ready for Review




### Done
- [x] **T001** — Monorepo scaffold + auth skeleton (JWT signup/login, org creation) | common-infrastructure | C2 | Risk: Med | P0 | Started: 2026-07-02 | Done: 2026-07-03
- [x] **T002** — Org/Kitchen/User invite flow + RBAC guard (RolesGuard + @Roles) | backend-developer | C2 | Risk: High | P0 | Started: 2026-07-03 | Done: 2026-07-03
- [x] **T003** — Base layout: sidebar/topbar, empty-state pages | frontend-developer | C1 | Risk: Low | P0 | Started: 2026-07-03 | Done: 2026-07-03
- [x] **T004** — Ingredient CRUD + StockBatch + StockMovement ledger | backend-developer | C2 | Risk: Med | P0 | Started: 2026-07-03 | Done: 2026-07-03
- [x] **T005** — Recipe CRUD + ingredients builder + auto cost roll-up | backend-developer | C2 | Risk: Med | P0 | Started: 2026-07-03 | Done: 2026-07-03
- [x] **T008** — Task CRUD + kanban board + list/calendar toggle | backend-developer | C2 | Risk: Med | P0 | Started: 2026-07-04 | Done: 2026-07-04
- [x] **T009** — Generate task from recipe/guideline (checklist from steps) | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-04 | Done: 2026-07-04
- [x] **T006** — Guideline (SOP) CRUD | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-04 | Done: 2026-07-04
- [x] **T011** — Stock deduction on recipe-linked task completion (FR-008 confirm-prompt) | backend-developer | C2 | Risk: High | P0 | Started: 2026-07-04 | Done: 2026-07-05
- [x] **T019** — RBAC enforcement audit, scoped to Inventory/Recipes/Guidelines/Tasks; Notes/Announcements/ShiftLog/Comments audit deferred to a follow-up once T012-T015 exist | backend-developer | C2 | Risk: High | P0 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T007** — Low-stock threshold flag + dashboard widget (endpoints + standalone LowStockWidget; UI evidence deferred to T018 which hosts it) | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T012** — Notes CRUD, tagging, pin, link-to-entity, search | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T013** — Announcements (broadcast + read receipts) | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T014** — Shift log (per-shift feed, time-sorted) | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T015** — Comments component (reusable) + @mentions | backend-developer | C2 | Risk: Med | P1 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T016** — Notification center (bell icon, unread count, mark-as-read) | backend-developer | C1 | Risk: Low | P1 | Started: 2026-07-05 | Done: 2026-07-05
- [x] **T018** — Home dashboard aggregation (today's tasks, low stock, announcements, pinned notes) | frontend-developer | C1 | Risk: Low | P0 | Started: 2026-07-05 | Done: 2026-07-06
- [x] **T010** — Recurrence support (cron-based daily prep list generation) | backend-developer | C2 | Risk: Med | P1 | Started: 2026-07-06 | Done: 2026-07-06
- [x] **T017** — Socket.IO realtime wiring (tasks/comments/announcements) | backend-developer | C2 | Risk: Med | P1 | Started: 2026-07-06 | Done: 2026-07-06
- [x] **T020** — CSV export for inventory & recipes | backend-developer | C1 | Risk: Low | P2 | Started: 2026-07-06 | Done: 2026-07-06
- [x] **T021** — Mobile responsive pass (tablet/phone breakpoints) | frontend-developer | C2 | Risk: Low | P1 | Started: 2026-07-06 | Done: 2026-07-06
- [x] **T023** — CI/CD: lint/test/build pipeline + Render staging auto-deploy (human follow-up needed: create Render service + secrets before staging deploy is live) | common-infrastructure | C2 | Risk: Med | P1 | Started: 2026-07-06 | Done: 2026-07-06

---

## Blocked

| Task | Reason | Waiting on |
|------|--------|-----------|
| T022 | Not yet started | — (all other tasks T001–T021, T023 complete) |
| T023 staging deploy (not the CI/CD code itself) | Workflow merged, but the actual Render deploy cannot fire yet | Human: create Render service(s), add `RENDER_DEPLOY_HOOK_WEB`, `RENDER_DEPLOY_HOOK_API`, `STAGING_DATABASE_URL` (optionally `RENDER_API_KEY` + service IDs) as GitHub repo secrets |
| Follow-up RBAC audit (Notes/Announcements/ShiftLog/Comments) | Ready to schedule as new task (e.g. T024) — all 4 modules now exist | — |

---

## Stage Tracker

| Stage | Status |
|-------|--------|
| 0.5 Brainstorming | ✅ Done |
| 1 Environment Setup | ✅ Done |
| 1.5 Sub-Agent Architecture | ✅ Done |
| 2 Planning (/plan) | ✅ Done |
| 3 Execution | 🔄 In Progress |
| 4 Review | ⬜ Not Started |
| 5 Integration & Verify | ⬜ Not Started |
