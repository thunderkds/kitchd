# PROJECT_KANBAN.md
**Last updated**: 2026-07-03

> Compact task board. Full context lives in `PROJECT_SPEC.md`. Update this file whenever a task status changes.

---

## Board

> Task line format: **Txxx** — [title] | [agent] | C[0–3] | Risk: Low/Med/High | P[0–2]

### Todo
- [ ] **T002** — Org/Kitchen/User invite flow + RBAC guard (RolesGuard + @Roles) | backend-developer | C2 | Risk: High | P0
- [ ] **T003** — Base layout: sidebar/topbar, empty-state pages | frontend-developer | C1 | Risk: Low | P0
- [ ] **T004** — Ingredient CRUD + StockBatch + StockMovement ledger | backend-developer | C2 | Risk: Med | P0
- [ ] **T005** — Recipe CRUD + ingredients builder + auto cost roll-up | backend-developer | C2 | Risk: Med | P0
- [ ] **T006** — Guideline (SOP) CRUD | backend-developer | C1 | Risk: Low | P1
- [ ] **T007** — Low-stock threshold flag + dashboard widget | backend-developer | C1 | Risk: Low | P1
- [ ] **T008** — Task CRUD + kanban board + list/calendar toggle | backend-developer | C2 | Risk: Med | P0
- [ ] **T009** — Generate task from recipe/guideline (checklist from steps) | backend-developer | C1 | Risk: Low | P1
- [ ] **T010** — Recurrence support (cron-based daily prep list generation) | backend-developer | C2 | Risk: Med | P1
- [ ] **T011** — Stock deduction on recipe-linked task completion (FR-008 confirm-prompt) | backend-developer | C2 | Risk: High | P0
- [ ] **T012** — Notes CRUD, tagging, pin, link-to-entity, search | backend-developer | C1 | Risk: Low | P1
- [ ] **T013** — Announcements (broadcast + read receipts) | backend-developer | C1 | Risk: Low | P1
- [ ] **T014** — Shift log (per-shift feed, time-sorted) | backend-developer | C1 | Risk: Low | P1
- [ ] **T015** — Comments component (reusable) + @mentions | backend-developer | C2 | Risk: Med | P1
- [ ] **T016** — Notification center (bell icon, unread count, mark-as-read) | backend-developer | C1 | Risk: Low | P1
- [ ] **T017** — Socket.IO realtime wiring (tasks/comments/announcements) | backend-developer | C2 | Risk: Med | P1
- [ ] **T018** — Home dashboard aggregation (today's tasks, low stock, announcements, pinned notes) | frontend-developer | C1 | Risk: Low | P0
- [ ] **T019** — RBAC enforcement audit across all CRUD (staff vs chef vs admin) | backend-developer | C2 | Risk: High | P0
- [ ] **T020** — CSV export for inventory & recipes | backend-developer | C1 | Risk: Low | P2
- [ ] **T021** — Mobile responsive pass (tablet/phone breakpoints) | frontend-developer | C2 | Risk: Low | P1
- [ ] **T022** — QA pass + seed demo data + onboarding walkthrough | qa-expert | C2 | Risk: Med | P0
- [ ] **T023** — CI/CD: lint/test/build pipeline + Railway staging auto-deploy | common-infrastructure | C2 | Risk: Med | P1

### In Progress

### Ready for Review

### Done
- [x] **T001** — Monorepo scaffold + auth skeleton (JWT signup/login, org creation) | common-infrastructure | C2 | Risk: Med | P0 | Started: 2026-07-02 | Done: 2026-07-03

---

## Blocked

| Task | Reason | Waiting on |
|------|--------|-----------|
| T002–T022 | Not yet started | — (T001 complete) |

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
