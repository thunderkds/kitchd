# TASK_GUIDE — T040: Assignable-users endpoint for CHEF + checklist `done` toggle
**Date**: 2026-07-28
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P2
**Assigned agent**: backend-developer (part A), then frontend-developer (part B)
**Agent guide**: `.claude/agents/backend.md` / `.claude/agents/frontend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read your agent guide (`.claude/agents/backend.md` or `.claude/agents/frontend.md`)
5. Note the **Complexity Level** above and apply the matching process (brainstorm / decompose / verify depth / model) from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. **C2 — required**: read `memory/codebase-map.md` for directory layout, entry points, and blast-radius hotspots

---

## Requirement (Pillar 1 — Adapt the requirement)

Origin: the two findings deferred from T039's Stage 4 review (1 P2, 1 P3), registered on
`PROJECT_KANBAN.md` as T040.

> "a CHEF may reassign any task but cannot read `GET /users` — `@Roles(OWNER, ADMIN)` — so the
> picker falls back to ids already on loaded tasks and cannot reach a member with no task;
> separately the edit dialog renders checklist text inputs but no `done` checkbox"

**Restated intent** (Supervisor's interpretation, in the project's domain language):
> A CHEF opening the Edit Task dialog sees **every active member of their own kitchen, by email**, in
> the assignee picker — including a member who currently has no task assigned — without gaining any
> of the team-management read surface T027 deliberately restricted to Owner/Admin. Separately,
> anyone who may edit a task's checklist can tick an item **done** from that same dialog.

**Out of scope** (what this task explicitly does NOT do):
- **Do not widen `@Get()` / `listMembers` or any other existing `users` route to CHEF.** That is the
  rejected alternative — it would hand CHEF the full `MEMBER_SELECT` payload (`role`, `isActive`)
  and the team-management surface. Add a narrow route instead.
- No change to `roles.guard.ts`. Its behaviour is settled (T002 / T019).
- No change to the Team & Roles page (T028) or its own `members` fetch.
- **No task status control in the edit dialog.** T039 established that a `PATCH {status:'DONE'}`
  bypasses T011's FR-008 stock deduction. This stays deliberately absent.
- No schema change and no migration → `migration-safety` is not in scope for this task.
- No fix for T027's `revokeInvite` 500 on a unique-constraint collision — a separate known gap.

**Requirement Refs** (FR/NFR/US IDs from `PRD.md` this task satisfies):
- FR-018: role-based permissions (CHEF is a write role for Tasks; Staff/Viewer are not)
- The Task-management user story from T008, whose reassignment half is currently unreachable for a
  CHEF in practice

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request (Supervisor — derived from T039's Stage 4 findings and confirmed against the live code on 2026-07-28)
- [x] Domain terms align with `PROJECT_SPEC.md` glossary (Kitchen, User, Task, assignee, checklist item)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] All Requirement Refs exist in `PRD.md` and are fully covered by the Acceptance Criteria below

---

## Dependencies & Reachability

**Depends on**: `None` — T039 is merged (`da89636`), and every other dependency already exists.
> `EditTaskDialog` shipped in T039; `PATCH /tasks/:id` and `ChecklistItemDto` (which **already**
> accepts `done?: boolean`) shipped in T008; `getCallerOrThrow` and `MEMBER_SELECT` shipped in T027.

**Entry point**: `listAssignableUsers`
> Backend: `GET /users/assignable` → `UsersService.listAssignableUsers`. Frontend: consumed by
> `fetchAssignableUsers()` in `apps/web/src/features/tasks/api.ts`, feeding the `assigneeOptions`
> `<select>` in `EditTaskDialog`, reached from the Edit control on both `TaskCard.tsx` (Kanban) and
> `ListView.tsx` (List).

---

## Acceptance Criteria

> Each criterion must trace back to the Requirement above (Pillar 1 → Pillar 3 link).

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A CHEF opens the Tasks page and the assignee picker lists **every active member of their kitchen by email**, including a member with zero tasks assigned | "cannot reach a member with no task" |
| 2 | `GET /users/assignable` returns objects containing **only** `id` and `email` — no `role`, no `isActive`, no other field | Restated intent — no team-management surface |
| 3 | A **STAFF** or **VIEWER** caller receives **403** from `GET /users/assignable` | FR-018 |
| 4 | The endpoint never returns a user from another kitchen, and never an inactive (deactivated) user | FR-018 / multi-tenant scoping |
| 5 | Ticking a checklist item's **done** box and saving persists `done: true`, with that item's `id` and `text` preserved and other items untouched | "no `done` checkbox" |
| 6 | A **STAFF** user editing their own task can toggle `done` and still sees no title/assignee/due-date fields | FR-018 — Staff may change status + checklist only |
| 7 | A task whose current assignee has since been **deactivated** still opens with that assignee selectable (not silently cleared), even though they are absent from the assignable list | Negative / boundary |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | CHEF token, kitchen has an active member with no tasks | `GET /users/assignable` 200, list includes that member's email | automated test + live verify |
| 2 | Any authorized caller | Response objects have exactly the keys `id`, `email` | automated test |
| 3 | STAFF token, then VIEWER token | `GET /users/assignable` → **403** both times | automated test |
| 4 | CHEF in kitchen A; kitchen B has active members; kitchen A has a deactivated member | Neither kitchen B's members nor the deactivated user appear | automated test |
| 5 | Edit dialog open, item 1 ticked done, save | `PATCH` body's `checklistItems[0]` = `{id, text, done: true}`; re-`GET` confirms persistence | automated test + live verify |
| 6 | STAFF user, own task, ticks done | PATCH succeeds (200); no title/assignee/dueAt input rendered | automated test |
| 7 | Task assigned to a deactivated user | Dialog opens with that assignee still selected; saving an unrelated field does not clear it | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/api && npx jest src/users && cd ../web && npx vitest run src/features/tasks && npm run build
```

> ⚠️ **Verified 2026-07-28 — the two apps use different test runners.** `apps/api` runs **jest**
> (`"test": "jest"`, `rootDir: src`, `testRegex: .*\.spec\.ts$`); only `apps/web` runs vitest.
> `npx vitest run src/users` in `apps/api` would fail outright.
>
> `npm run build` is included deliberately: T038's learning is that `tsc -b` catches breakage
> `vitest` does not. Run this command yourself — do not trust a reported pass (T016 learning), and
> note the vitest `-- <keyword>` filter matches **filenames**, not feature names (T016).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | 19 new tests written as part of T040. Backend: `apps/api/src/users/assignable.e2e.spec.ts` (new, 11 tests, matrix style — AC1–AC4 incl. the negative direction that CHEF still gets 403 on `GET /users` and `GET /users/invites`). Frontend: `apps/web/src/features/tasks/TasksPage.test.tsx` (+5 — AC1 CHEF reads the new route and never the wide one, AC5, AC6, AC7, VIEWER makes no call) and `apps/web/src/features/tasks/EditTaskDialog.test.tsx` (+3 — checkbox reflects stored done, un-tick sends `done:false` with id and text, newly added item ticks without an id). Output pasted in the row below — a pass. |
| Verification command run | ☒ pass | Supervisor ran the guide's exact command personally, not trusting the agents' reports (T016 learning). Backend `npx jest src/users` → `Test Suites: 4 passed, 4 total / Tests: 39 passed, 39 total`. Frontend `npx vitest run src/features/tasks` → `Test Files 4 passed (4) / Tests 44 passed (44)`. `npm run build` (which is `tsc -b && vite build`, the T038 gate) → `✓ built in 987ms`, no type errors. All three pass. |
| Negative cases hold | ☒ pass | Verified live against the running API, not in mocks — `reports/evidence/T040/09-supervisor-verify-api.sh`, 9/9 checks, `OVERALL: pass`. AC3 role matrix: OWNER 200, CHEF 200, STAFF **403**, VIEWER **403**, no token **401**. Negative direction: CHEF still **403** on both `GET /users` and `GET /users/invites`, so a future accidental widening of `listMembers` breaks a test. AC2: response keys are exactly `email,id`. The script treats an empty actual as an automatic FAIL, per the T039 false-pass learning. |
| verify | ☒ pass | Stage 5 verify run by the Supervisor against the live stack. API contract 9/9 with `OVERALL: pass`. AC5 live round-trip performed independently: PATCH toggling item 1's `done` returned 200 and a fresh GET confirmed `done` flipped while **both** items kept their original `id` and `text`, and item 2 was untouched — ids `b776ee50…` and `19586c9c…` identical before and after. UI screenshots opened and read directly rather than accepted on filename. Result is a pass. |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed: the 6 changed source files plus their 2 test files. Read as contract authority but not reviewed: `features/team/api.ts`, `tasks.service.ts`, `checklist-item.dto.ts`, `roles.guard.ts`. Skipped: the rest of the repo, untouched by this diff. As on T039, the security-review harness supplied a mis-scoped whole-history diff (5MB, ~300 pre-existing files); analysis was deliberately re-scoped to `da89636..2d67d0f`. A pass. |
| Full smoke suite still green (no regression) | ☒ pass | Backend `npx jest` → 26 suites / **213 tests passed**, up from 202 with no failures or skips. Frontend `npx vitest run` → 29 files / **181 tests passed**, up from 174. Both re-run by the Supervisor post-implementation. |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | Screenshots opened and read by the Supervisor directly. `02-edit-dialog-chef-simple.png` — the CHEF's assignee picker shows a real address, `staff@demo.kitchenos.dev`, with zero truncated-UUID labels, which is the whole point of the task; checkboxes sit aligned with the text input and Remove button. `04-edit-dialog-chef-dark-neon.png` — same layout legible in dark-neon with the checked box clearly crimson. `05-edit-dialog-staff-simple.png` — STAFF sees checklist plus checkboxes only, no title/assignee/due-date inputs. |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | Computed styles: checkbox `accentColor` is `rgb(147,51,234)` in simple and `rgb(213,25,68)` in dark-neon, matching `--color-accent` (`#9333ea` / `#d51944`) — so it tracks the theme token rather than a hardcoded value, visually confirmed in both screenshots above. Wrapper hit area 44×44px, matching the Remove/Add buttons. Dialog panel still resolves `bg-surface-raised`. Regex scan confirms **no** `bg-primary` / `text-on-primary` in the dialog markup, avoiding T033's invisible-label bug. |
| **UI: Responsiveness at target viewports** | ☒ pass | Captured at 320px, 768px and 1440px (`06/07/08-dialog-*.png`). Checklist row right edge 288 ≤ 320, 584 ≤ 768, 920 ≤ 1440 — no row overflow at any width. One measured caveat, stated rather than hidden: at 320px the page reports `scrollWidth 363 > clientWidth 320`, but a baseline captured with the dialog **closed** gives the identical 363, so it is the pre-existing Kanban-column layout and not introduced here. 768 and 1440 show zero overflow. |

---

## UI / Design Acceptance Criteria

### 1. Visual Regression

| Screen / Component | Verification method | Expected result |
|-------------------|---------------------|-----------------|
| `EditTaskDialog` assignee `<select>`, both themes | screenshot + LLM vision verdict | Full member emails listed, no truncated-UUID labels; readable in `simple` and `dark-neon` |
| `EditTaskDialog` checklist rows, both themes | screenshot + LLM vision verdict | Checkbox aligned with the text input and Remove button; checked state visibly distinct |

### 2. Design-System Compliance

| Criterion | Verification method | Expected result |
|-----------|---------------------|-----------------|
| Colors match design tokens | computed-style check | Checkbox accent and any new control use theme tokens — **never** the undefined `bg-primary` / `text-on-primary` (T033's invisible-label bug) |
| Surfaces use theme tokens | CSS audit | Dialog panel still supplies `bg-surface-raised` via the shared `Dialog` primitive (T026 gap learning) |
| Touch target | computed style | Checkbox hit area meets the ≥44px convention already used by the Remove / Add buttons in this dialog |

### 3. Layout / Responsiveness

| Viewport | Verification method | Expected result |
|----------|---------------------|-----------------|
| Mobile (320–480px) | browser screenshot | Checklist row (checkbox + input + Remove) fits, no horizontal overflow |
| Tablet (768px) | browser screenshot | Dialog centered, no overflow |
| Desktop (1024px+) | browser screenshot | Dialog centered at max-width |

---

## Approach

Two parts. **Do part A first and confirm it is green before starting part B** — B consumes A's route.

### Part A — backend (`apps/api/src/users/`)

1. `users.service.ts`: add `listAssignableUsers(callerId)` directly after `listMembers`
   (~line 154). Reuse the existing `getCallerOrThrow(callerId)` and the **identical** query shape:
   `where: { kitchenId: caller.kitchenId, isActive: true }`, `orderBy: { email: 'asc' }`.
   The only difference is a new module-level `ASSIGNABLE_SELECT = { id: true, email: true } as const`
   — **not** `MEMBER_SELECT`, which would leak `role` and `isActive`.
2. `users.controller.ts`: add
   ```ts
   @Get('assignable')
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(Role.OWNER, Role.ADMIN, Role.CHEF)
   ```
   Place it beside the other static-segment GET (`@Get('invites')`, ~line 47) and **before** the
   bare `@Get()`, matching this file's existing static-before-generic ordering.

Kitchen scoping must live **inside** the Prisma query, never as a post-fetch filter — the T015
mention-lookup pattern.

### Part B — frontend (`apps/web/src/features/tasks/`)

1. `api.ts`: add `fetchAssignableUsers()` using the file's existing `request<T>()` helper, so T029's
   `notifyApiError()` wiring applies for free. Do **not** introduce a new HTTP client (T029 decision).
2. `TasksPage.tsx` — this is the crux of Part B, and it is **not** where you might first look:
   - Today the page imports `listMembers` from `../team/api` (line 11) and calls it in the mount
     effect **only** for `MEMBER_READ_ROLES = ['OWNER', 'ADMIN']` (declared line 44, used line 113).
     That constant is precisely the CHEF exclusion this task exists to remove.
   - Replace that call with `fetchAssignableUsers()` from this feature's own `api.ts`, gated on
     `WRITE_ROLES` (line 41 — already `['OWNER','ADMIN','CHEF']`). `MEMBER_READ_ROLES` then has no
     remaining use in this file and should go, along with the now-unused `../team/api` import and
     the stale comment at lines 108-110 that documents the 403 fallback.
   - Do **not** edit `apps/web/src/features/team/api.ts` itself — T028's page is its other consumer
     and keeps using `listMembers` unchanged. Only the *import from* Tasks goes away.
   - In the `assigneeOptions` IIFE (lines 161-173), source options from the new endpoint but
     **keep the id fallback loop** — it is what makes AC7 hold for a since-deactivated assignee.
3. `EditTaskDialog.tsx`: leave the `assigneeOptions` prop contract and the unknown-assignee patch-in
   (lines 93-99) unchanged. Add a `done` checkbox to each checklist row (lines 245-262) and include
   `done` in the PATCH payload alongside the preserved `id` and `text`.

**Why role-gate the client at all, given the server enforces it?** Purely for affordance — a control
that always 403s is a UX bug. The server remains the only real authority; never treat the client
gate as the security boundary.

---

## RBAC Contract (verified against the live code 2026-07-28 — do not guess)

`PATCH /tasks/:id` carries **no `@Roles` decorator**; enforcement lives in `TasksService.update`:

| Role | May change on a Task |
|---|---|
| `OWNER` / `ADMIN` / `CHEF` (`WRITE_ROLES`) | Any field, on any task in their kitchen |
| `STAFF` | `status` and `checklistItems` **only**, and **only** where `assigneeId === caller.id` |
| `VIEWER` | Nothing — always `403` ("Viewer role is read-only", the T019 fix) |

New route added by this task:

| Route | Roles |
|---|---|
| `GET /users/assignable` | `OWNER`, `ADMIN`, `CHEF` |
| every other `users` route (unchanged) | `OWNER`, `ADMIN` |

`assigneeId` must resolve to a user in the caller's own kitchen or `TasksService` throws
(`assertAssigneeInKitchen`). Never send a raw user ID from an unscoped list.

> Read this table, not another module's RBAC shape. Memory's T013/T014 learnings are explicit: this
> codebase has at least four distinct RBAC shapes, and copying one across features has caused real
> bugs — including a stale RBAC assumption baked into a TASK_GUIDE.

---

## Edge Case Checklist

- [ ] Route ordering: `@Get('assignable')` must not be shadowed by a generic `@Get(':id')` — place it with the static-segment routes
- [ ] Response contains no `role` / `isActive` — assert the exact key set, not just that email is present
- [ ] Caller's own user appears in the list (self-assignment is legitimate)
- [ ] Deactivated members excluded from the list, but a task already assigned to one still opens with that assignee selected (AC7)
- [ ] Cross-kitchen assignee id still rejected by `assertAssigneeInKitchen`
- [ ] Toggling `done` must not wipe item `id`s — T008 learning: sending the array replaces its content wholesale
- [ ] Toggling `done` in the edit dialog must not corrupt the completion flow's checklist state (`CompleteTaskDialog`)
- [ ] Unassign (`assigneeId: null`) still works; a due-date clear is still refused (T039: `dueAt:null` would persist the Unix epoch)
- [ ] Empty / whitespace-only title still blocked client-side
- [ ] STAFF and VIEWER get 403 from the new route, and the frontend never calls it for them (no console 403 noise)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/api/src/users/users.service.ts` | Add `ASSIGNABLE_SELECT` + `listAssignableUsers(callerId)` reusing `getCallerOrThrow` |
| `apps/api/src/users/users.controller.ts` | Add `@Get('assignable')` with `@Roles(OWNER, ADMIN, CHEF)`, before the bare `@Get()` |
| `apps/api/src/users/assignable.e2e.spec.ts` | **New** — tests for AC2–AC4, role×verb matrix style. Match the module's existing convention: `src/users/` already holds `team.e2e.spec.ts`, `theme.e2e.spec.ts`, `users-invite.e2e.spec.ts` — there is **no** `users.service.spec.ts` and no unit-test convention in this module |
| `apps/web/src/features/tasks/api.ts` | Add `fetchAssignableUsers()` via the existing `request<T>()` helper |
| `apps/web/src/features/tasks/TasksPage.tsx` | Replace the `listMembers()` path (see below); source `assigneeOptions` from the new endpoint; keep the id fallback |
| `apps/web/src/features/tasks/EditTaskDialog.tsx` | Add per-item `done` checkbox; include `done` in the PATCH payload |
| `apps/web/src/features/tasks/EditTaskDialog.test.tsx` | Tests for AC5–AC7 |
| `apps/web/src/features/tasks/TasksPage.test.tsx` | Test for AC1 (CHEF sees emails, incl. a taskless member) |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/auth/guards/roles.guard.ts` | Settled behaviour (T002/T019); this task adds a route, not a guard change |
| `apps/api/src/users/users.service.ts` → `listMembers` / `MEMBER_SELECT` | Widening the existing member list is the explicitly rejected alternative |
| `apps/api/prisma/schema.prisma` | No schema change — no migration in scope |
| `apps/web/src/features/team/**` | T028's page owns its own `members` fetch; out of scope |
| `apps/web/src/features/tasks/CompleteTaskDialog/**` | Completion flow works; out of scope |
| `apps/web/src/components/Dialog/Dialog.tsx` | Reuse the shared primitive as-is |

---

## Test Plan

**Backend**: tests in `apps/api/src/users/` covering AC2–AC4 written **matrix style** (role × the new
route), not as a single happy-path case — the T019 learning is that per-feature test suites do not
reliably catch a role-omission gap; a Viewer gap survived four merged tasks and two security reviews
before a dedicated matrix audit found it.

**Frontend**: component tests with the API module mocked, asserting the exact PATCH payload for a
`done` toggle (AC5) and that the CHEF picker renders emails including a taskless member (AC1).

**Live pass** against the running stack (postgres + API `:3000` + web `:8766`): log in as a CHEF
against seeded data (`apps/api/prisma/seed.ts`), confirm a taskless member appears in the picker by
email, assign the task to them, tick a checklist item, save, and re-`GET` the task to confirm
persistence with ids preserved. Then repeat the 403 probes with STAFF and VIEWER tokens.

`easy-ui-mcp` is available again as of 2026-07-24 (the 2026-07-14 "environment-wide gap" note is
stale) — check with `ToolSearch` first, and note that `ui_assert` takes a **JS expression**, not
prose, and that a session status of "failed" may reflect harness/selector errors only, so enumerate
`actions[]` before calling anything a product failure. Implementer sub-agents typically cannot reach
`easy-ui-mcp`; Playwright with the same DOM-assertion methodology is the accepted substitute.

Archive screenshots and the API session to `reports/evidence/T040/` and commit them — a UI change is
not evidenced until those files are in the repo.

---

## Completion Checklist

- [ ] Part A (backend) implemented and green **before** Part B starts
- [ ] Part B (frontend) implemented
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run — **mandatory**, Medium risk, new RBAC-bearing route
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `npm run build` clean (T038 learning — `vitest` alone is not sufficient)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working in running app
- [ ] Worktree changes actually **committed** — `git -C <worktree> log/status` checked (T027/T039: implementations have twice sat uncommitted while reported done)
- [ ] `memory/MEMORY.md` updated (if new patterns or feedback learned)
- [ ] Supervisor notified: task ready for Stage 4 review
