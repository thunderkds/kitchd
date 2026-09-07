# PROJECT_KANBAN.md
**Last updated**: 2026-09-07

> Compact task board. Full context lives in `PROJECT_SPEC.md`. Update this file whenever a task status changes.

---

## Board

> Task line format: **Txxx** — [title] | [agent] | C[0–3] | Risk: Low/Med/High | P[0–2]

### Todo
> Registered by the T042 coverage audit — see `docs/audits/backend-frontend-coverage_2026-07-28.md`. TASK_GUIDEs not yet written; each needs Stage 2 before pickup.
- [ ] **T049** — Allow clearing a set low-stock threshold (T041 P2: clearing the input sends no key, so the old value silently persists; needs `minThreshold: null` in the payload + backend nullability) | backend-developer + frontend-developer | C1 | Risk: Low | P2 | ⚠️ guide not yet written
- [ ] **T050** — Extend `rbac-matrix.e2e.spec.ts` to cover the `/users` routes (T040 P2: the audit built to catch role-omission gaps asserts nothing about any `/users` route) | backend-developer | C1 | Risk: Medium | P2 | ⚠️ guide not yet written

### In Progress
- **T048** — Kitchen rename in Settings (`GET`/`PATCH /kitchens/:id`; kitchen name fixed at signup forever) | frontend-developer | C0 | Risk: Low | P2 | Started: 2026-09-07 | guide written
- **T045** — Expiring-soon widget (`GET /inventory/alerts/expiring` has no consumer; other half of T007, `LowStockWidget` is a working template) | frontend-developer | C1 | Risk: Low | P1 | Started: 2026-09-07 | guide written
- **T046** — CSV export controls (`/export/ingredients`, `/export/recipes` — all of T020 is unreachable) | frontend-developer | C1 | Risk: Low | P1 | Started: 2026-09-07 | guide written
- **T047** — Recipe version history UI (`GET /recipes/:id/versions`; T005's append-only audit trail is invisible) | frontend-developer | C1 | Risk: Low | P2 | Started: 2026-09-07 | guide written
- **T044** — Shift Log page + sidebar entry (T014's whole module unreachable: no page, no `features/shift-logs/`, not in nav) | frontend-developer | C2 | Risk: Low | P1 | Started: 2026-09-07 | guide written

### Ready for Review


### Done
- [x] **T043** — Invite acceptance: team onboarding was impossible end to end (F1 from the T042 audit; the flow was broken at both ends — no mailer exists, so `TeamPage` discarded the token while claiming "Invite sent", and `POST /users/invite/accept` had no UI or public route) | frontend-developer | C2 | Risk: Medium | **P0** | Copy-link delivery, no email (user decision) | Frontend-only, backend complete since T002 | `d97109b` | code-review 0 P0/P1/P2/P3 — cleanest of the session; agent **mutation-tested** the public-route assertion (moved it inside `AuthGuard`, confirmed the test failed, restored) | security-review 0 High/Med on a public unauthenticated account-creating route (token never logged, no Referer leak path, `navigate(replace:true)` drops the token from history, collapsed 404 preserves no-enumeration) | 199/199 frontend green post-merge (14 new), `npm run build` clean | Stage 5 verify: Supervisor proved the before/after live — accept lands the invitee in the **inviting** kitchen `913ca19e…` as STAFF, while signup lands in a different tenant `706d1bd7…` as OWNER | 1 product call awaiting sign-off: accepting while signed in as someone else warns and proceeds rather than blocking | Started: 2026-07-28 | Done: 2026-07-28
- [x] **T042** — Backend↔frontend coverage audit: enumerated all 58 backend routes against every non-test frontend source, found **9 routes across 6 features with no consumer at all**, and hardened the TASK_GUIDE template with a required `Consumer:` declaration so a backend task can no longer be marked Done with no UI and no registered follow-up | Supervisor | C1 | Risk: Low | P1 | Report: `docs/audits/backend-frontend-coverage_2026-07-28.md` | Registered T043–T048; headline finding is P0 (invite acceptance impossible, invitees silently land in the wrong tenant) | Started: 2026-07-28 | Done: 2026-07-28
- [x] **T041** — Low-stock threshold is unreachable from the Ingredient form (bug, origin defect since T031: `IngredientFormDialog` never collected `minThreshold`, so every UI-created ingredient stayed `null` and was permanently excluded by `AlertsService#lowStock`'s `gt: 0` filter — T007 alerts + T016 notifications were inert for all non-seeded data; edit path also dropped `category`) | frontend-developer | C1 | Risk: Low | P1 | Frontend-only — schema/DTOs/AlertsService/LowStockWidget were all already correct | Create pre-fills threshold `5` (user decision), client-side not in the DTO | `522d666` + review fixes `e893a85` + Supervisor evidence `5f65789` | code-review 1 **P1 found and fixed at review** (typed `0` was accepted and, being `gt: 0`-excluded, silently recreated the original bug — now blocked with a regression test), 1 P2 deferred (no way to clear a set threshold), 1 P3 | security-review not required (Risk Low, no auth/data surface) | 187/187 frontend green post-merge (7 new), `npm run build` clean | Stage 5 verify: live before/after contrast — `BeforeFixIngredient` (null threshold) absent from the alert feed, UI-created ingredients present; Dashboard LowStockWidget shows `0 kg (min 3)` | Supervisor re-captured the dark-neon UI evidence after finding the agent's "both themes" screenshots were the same theme | Started: 2026-07-28 | Done: 2026-07-28
- [x] **T040** — Assignee-picker completeness for CHEF + checklist `done` toggle in `EditTaskDialog` (T039 Stage 4 follow-up; closes both deferred findings) | backend-developer + frontend-developer | C2 | Risk: Medium | P2 | New narrow `GET /users/assignable` (`@Roles(OWNER, ADMIN, CHEF)`, `{id, email}` only) — deliberately NOT a widening of `GET /users` | Part A `308fb02` + Part B `2d67d0f` | code-review 0 P0/P1 (1 P2 pre-existing central-audit gap, 2 P3 comment hygiene) | security-review 0 High/Med | 213/213 backend + 181/181 frontend tests green post-merge (19 new), `npm run build` clean | Stage 5 verify: live API 9/9 `OVERALL: pass` + AC5 checklist round-trip + both-theme screenshots reviewed | Started: 2026-07-28 | Done: 2026-07-28
- [x] **T039** — Edit Task UI: change title/assignee/due-date/checklist on an existing task (backend `PATCH /tasks/:id` has existed since T008; only the frontend affordance was missing) | frontend-developer | C2 | Risk: Medium | P1 | code-review 0 P0/P1, 1 P2 + 1 P3 deferred (both need an out-of-scope backend change — see T040) | security-review 0 High/Med | 174/174 frontend tests green post-merge (18 new) | `npm run build` clean | Stage 5 verify: API contract 12/12 + live browser, both Kanban and List views | Started: 2026-07-23 | Done: 2026-07-24
- [x] **T038** — Fix `npm run build` (`tsc -b`) CI failure — 3 independent test-fixture typing gaps (Task.sourceRecipeId/sourceGuidelineId missing from 2 test helpers since T035, querySelector generic, tuple-filter predicate), root cause diagnosed during T037 review | Supervisor | C0 | Risk: Low | P1 | `npm run build` clean | 156/156 tests green | Started: 2026-07-20 | Done: 2026-07-20
- [x] **T037** — Convert all create/edit forms (Recipes, Guidelines, Inventory, Announcements, Notes, Team) to the shared Dialog modal pattern, matching Tasks' CreateTaskDialog | frontend-developer | C3 | Risk: Medium | P1 | code-review 0 P0/P1, 2 P2 informational (pre-existing tsc -b gap flagged, not introduced) | 156/156 frontend tests green | live browser verify passed | Started: 2026-07-20 | Done: 2026-07-20
- [x] **T036** — Recipes Page (list + detail + create/edit, cost roll-up) — closes the last of the T031/T032/T033/T035-class backend-done/frontend-missing gaps | frontend-developer | C2 | Risk: Low | P1 | code-review 0 P0/P1, 2 P2 advisory (resolved via live verify) | 154/154 frontend tests green | live browser + curl verify passed | Started: 2026-07-20 | Done: 2026-07-20
- [x] **T035** — Task creation UI + Recipe/Guideline/Inventory relation visibility (3-mode Create Task dialog: Plain/From Recipe/From Guideline; source-recipe/guideline titles + ingredient names now visible) | frontend-developer | C2 | Risk: Low | P1 | code-review 0 P0/P1, 1 P2 fixed (list view was missing source-title line) | 143/143 frontend tests green post-fix | live browser verify passed | Started: 2026-07-20 | Done: 2026-07-20
- [x] **T034** — Global pointer-cursor rule for all clickable elements (buttons, role=button, summary) — bugfix follow-up to T030, closes native-`<button>`-has-no-default-pointer-cursor gap | frontend-developer | C0 | Risk: Low | P2 | code-review 0 P0, 1 P1 fixed (test coverage gap) | 137/137 frontend tests green post-fix | Started: 2026-07-20 | Done: 2026-07-20
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
- [x] **T022** — QA pass + seed demo data + onboarding walkthrough (all 8 PRD MVP acceptance criteria verified live; 1 bug found+fixed: mention notification body UUID) | qa-expert | C2 | Risk: Med | P0 | Started: 2026-07-06 | Done: 2026-07-06
- [x] **T024** — RBAC enforcement audit — Notes, Announcements, ShiftLog, Comments (no gap found, all 4 already correct; surfaced product finding: ADMIN role has no creation path anywhere) | backend-developer | C2 | Risk: High | P0 | Started: 2026-07-06 | Done: 2026-07-06
- [x] **T025** — Backend theme-preference: `User.themePreference` enum (`Theme { simple, dark_neon }`) + self-service `PATCH /users/me/theme` endpoint | backend-developer | C1 | Risk: Low | P1 | migration-safety: GO | code-review: 0 findings | 186/186 tests green post-merge | Started: 2026-07-14 | Done: 2026-07-14
- [x] **T026** — Frontend theme system: semantic CSS-variable tokens, Dark Neon palette, full 18-file migration, settings-page switcher | frontend-developer | C2 | Risk: Low | P1 | code-review: 0 findings | 73/73 frontend tests green post-merge | UI evidence archived | Started: 2026-07-14 | Done: 2026-07-14
- [x] **T027** — Backend team management: member list, role-change (Chef/Staff/Viewer only), remove/deactivate, pending-invite list + revoke | backend-developer | C2 | Risk: High | P1 | migration-safety: GO | code-review 0 P0/1 P1(accepted) | security-review 0 High/1 Med(accepted) | 202/202 tests green post-merge | Started: 2026-07-14 | Done: 2026-07-14
- [x] **T028** — Frontend Team & Roles page: member roster, role-change, remove, invite, revoke, Owner/Admin-gated | frontend-developer | C2 | Risk: Medium | P1 | code-review 0 P0/P1, 1 P2 advisory | 82/82 frontend tests green post-merge | UI evidence archived | Started: 2026-07-14 | Done: 2026-07-14
- [x] **T029** — Global Error/Warning Dialog: blocking modal for all API/network errors app-wide (ErrorDialogProvider + notifyApiError() singleton, wired into 7 api.ts files) | frontend-developer | C2 | Risk: Low | P1 | code-review 0 P0/P1, 1 P3 advisory | 98/98 frontend tests green post-merge | UI evidence archived | Started: 2026-07-19 | Done: 2026-07-19
- [x] **T030** — Pointer cursor on Dialog overlay (only non-native clickable element missing `cursor-pointer`) | frontend-developer | C0 | Risk: Low | P2 | code-review 0 findings | 102/102 frontend tests green post-merge | Started: 2026-07-19 | Done: 2026-07-19
- [x] **T031** — Inventory Page: ingredient list + derived stock, Owner/Admin/Chef create/edit/receive-stock, view-only for Staff/Viewer | frontend-developer | C2 | Risk: Low | P1 | code-review 0 P0/P1 (1 P2 advisory) | 111/111 frontend tests green post-merge | UI evidence archived | Started: 2026-07-19 | Done: 2026-07-19
- [x] **T032** — Guidelines Page: SOP list + detail view + Owner/Admin/Chef create/edit, view-only for Staff/Viewer | frontend-developer | C2 | Risk: Low | P1 | code-review 0 findings | 110/110 frontend tests green post-merge | UI evidence archived | Started: 2026-07-19 | Done: 2026-07-19
- [x] **T033** — Announcements Page: full history + Owner/Chef-only broadcast (Admin excluded), read-receipt counts | frontend-developer | C2 | Risk: Low | P1 | code-review 1 P1 fixed (invisible button label) | 111/111 frontend tests green post-merge | UI evidence archived | Started: 2026-07-19 | Done: 2026-07-19

---

## Blocked

| Task | Reason | Waiting on |
|------|--------|-----------|
| T023 staging deploy (not the CI/CD code itself) | Workflow merged, but the actual Render deploy cannot fire yet | Human: create Render service(s), add `RENDER_DEPLOY_HOOK_WEB`, `RENDER_DEPLOY_HOOK_API`, `STAGING_DATABASE_URL` (optionally `RENDER_API_KEY` + service IDs) as GitHub repo secrets |

---

## Stage Tracker

| Stage | Status |
|-------|--------|
| 0.5 Brainstorming | ✅ Done |
| 1 Environment Setup | ✅ Done |
| 1.5 Sub-Agent Architecture | ✅ Done |
| 2 Planning (/plan) | ✅ Done |
| 3 Execution | ✅ Done — all 24 tasks (T001–T024) implemented |
| 4 Review | ✅ Done — code-review/security-review/migration-safety passed per-task |
| 5 Integration & Verify | 🔄 In Progress — merges + live verify done per-task; `ship` not yet run |
