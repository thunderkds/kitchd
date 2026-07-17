# TASK_GUIDE — T027: Backend team management (member list, role-change, remove, invite management)
**Date**: 2026-07-14
**Complexity Level**: C2
**Risk Level**: High
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

Before writing any code:
1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. Note the **Complexity Level** above (C2) and apply the matching process from the Complexity matrix in `.claude/agents/general-agent-template.md`
6. C2 — read `memory/codebase-map.md` for directory layout before starting

Also read `BRAINSTORMING_LOG_team-roles.md` for full context, and `memory/decisions.md`'s RolesGuard/kitchen-scoped-controller entries (2026-07-03) — this task reuses that exact pattern.

---

## Requirement (Pillar 1 — Adapt the requirement)

User request: "implement the team & role, I see it clean for now" (the `/team` sidebar link has always rendered an empty placeholder — no team-management backend or UI exists beyond invite-creation/acceptance from T002).

**Restated intent** (Supervisor's interpretation):
> Owner/Admin needs to actually administer their kitchen's team: see who's a member, change a member's role (bounded to Chef/Staff/Viewer), remove a member, and see/revoke pending invites. This task is the backend half — the API surface the frontend (T028) will consume.

**Out of scope** (what this task explicitly does NOT do):
- No frontend UI — that is T028, blocked on this task.
- No path to grant Owner/Admin via invite or role-change — that gap (flagged since T002/T019) stays open; explicitly out of scope per user decision during brainstorming.
- No hard `DELETE` of a User row — "remove" is a soft-deactivation (`isActive: false`), preserving FK integrity for historical StockMovement/Task/Comment references.
- No self-removal, no removing/demoting another Owner/Admin.

**Requirement Refs** (FR/NFR/US IDs from `PRD.md` this task satisfies):
- FR-026: member roster, role-change (Chef/Staff/Viewer only), remove/deactivate, pending-invite view/revoke.
- US-015: Owner/Admin can actually administer team access.

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [ ] Restated intent confirmed to match the user's request (by Supervisor / user — not the implementing agent)
- [ ] Domain terms align with `PROJECT_SPEC.md` glossary — "deactivate" means `User.isActive = false`, not a row deletion; confirm no existing glossary term conflicts
- [ ] Every Acceptance Criterion below traces to a line in the Requirement
- [ ] All Requirement Refs exist in `PRD.md` and are fully covered by the Acceptance Criteria above

> An agent must NOT start implementing until this gate is checked. If anything here is unclear,
> STOP and ask the Supervisor (Karpathy: Think Before Coding).

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | `GET /users` (kitchen-scoped, Owner/Admin only) returns all active members of the caller's own kitchen — id, email, role, isActive — never another kitchen's roster | FR-026 |
| 2 | `PATCH /users/:id/role` (Owner/Admin only) updates a target member's role to CHEF/STAFF/VIEWER; requesting OWNER/ADMIN as the new role is rejected with 400 | FR-026, locked scope decision |
| 3 | `PATCH /users/:id/role` / `DELETE /users/:id` targeting a user in a **different** kitchen returns 404, not 403 (matches the established kitchen-scoped-controller pattern — never confirm existence cross-tenant) | Security pattern (`memory/decisions.md` RolesGuard entry) |
| 4 | `PATCH /users/:id/role` / `DELETE /users/:id` targeting an OWNER or ADMIN user is rejected with 403 | Locked scope decision (no demoting/removing Owner/Admin) |
| 5 | `DELETE /users/:id` where `:id` is the caller's own id is rejected with 400 (no self-removal) | Locked scope decision |
| 6 | `DELETE /users/:id` sets `isActive: false`, does not delete the row; the user's existing `StockMovement`/`Task.assigneeId`/`Comment.authorId` references remain valid and readable afterward | Edge case, 50% Rule Check (soft-delete) |
| 7 | A deactivated (`isActive: false`) user attempting `POST /auth/login` receives 401, not a stack trace or generic 500 | Edge case |
| 8 | `GET /users/invites` (Owner/Admin only) lists the caller's kitchen's PENDING invites only (not ACCEPTED, not another kitchen's) | FR-026 |
| 9 | `DELETE /users/invites/:id` revokes a pending invite (e.g. sets status to a revoked/cancelled state, or deletes the row — implementer's choice, document which); revoking an already-accepted or already-revoked invite fails gracefully (404 or 409, not 500) | FR-026, edge case |
| 10 | Chef/Staff/Viewer calling any of the 4 new routes receives 403 | FR-026, FR-018 pattern |

---

## Evaluation & Acceptance (How we know the agent worked correctly)

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Owner calls `GET /users` | 200, returns only own-kitchen active members | automated test |
| 2 | Owner PATCHes a Staff member's role to CHEF | 200, role updated | automated test |
| 3 | Owner PATCHes a member's role to OWNER | 400 | automated test |
| 4 | Owner PATCHes/DELETEs another kitchen's user id | 404 | automated test |
| 5 | Admin attempts to DELETE an Owner | 403 | automated test |
| 6 | Owner attempts to DELETE themselves | 400 | automated test |
| 7 | Owner DELETEs a Staff member, then that Staff member's prior StockMovement/Task/Comment rows are re-fetched | 200, data intact, `user.isActive === false` on the deactivated user's row | automated test |
| 8 | Deactivated user attempts login | 401 | automated test |
| 9 | Staff (non-Owner/Admin) calls any of the 4 new routes | 403 on all 4 | automated test |
| 10 | Owner revokes a pending invite, then reuses its token via `POST /users/invite/accept` | Original invite no longer usable (404/409) | automated test |

### Verification Command (exact, runnable)

```bash
cd apps/api && npm test -- team
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is
> filled with real, pasted output — not just checked. The `verify` row's first cell must be a bare
> `| verify |` (no backticks), and its Notes cell must contain the literal word "pass" (case-insensitive)
> — the word must appear in the **Notes cell itself**, not only the Result cell (a `☒ pass` Result alone
> does not satisfy the merge-gate hook — see `memory/learnings.md` 2026-07-14 T025 entry).

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/api/src/users/team.e2e.spec.ts` — 16 tests covering all 10 Acceptance Criteria + full 4-route × 3-role RBAC matrix |
| Verification command run | ☒ pass | `cd apps/api && npm test -- team` → 16/16 passed, see `reports/evidence/T027/verify-session.md` |
| Negative cases hold | ☒ pass | OWNER/ADMIN-as-role-target 400, cross-tenant 404, target-is-Owner/Admin 403, self-removal 400, deactivated-login 401, revoke-then-reuse 404, double-revoke 409 — all verified live and in the e2e spec |
| verify | ☒ pass | pass — live API session (curl, 13 probes: signup/invite/accept, list/role-change/reject-Owner-role/403-non-privileged/self-removal-400/deactivate/deactivated-login-401/pending-invites/revoke/reuse-404/cross-tenant-404) all behaved exactly as specified — see `reports/evidence/T027/verify-session.md` |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | Reviewed the 4 changed files (schema.prisma, auth.service.ts, users.controller.ts, users.service.ts) + 2 new files (DTO, e2e spec) only; `roles.guard.ts` and every other module confirmed untouched, matching "Files Must NOT Touch" |
| Full smoke suite still green (no regression) | ☒ pass | `npm test` → 25 suites / 202 tests passed (up from 186 pre-T025/T026/T027), see `reports/evidence/T027/verify-session.md` |
| **UI: Visual regression** | ☒ N/A | pure-backend task |
| **UI: Design-system compliance** | ☒ N/A | pure-backend task |
| **UI: Responsiveness** | ☒ N/A | pure-backend task |

> **Evidence-archiving rule (required):** copy any external-tool artifacts into `reports/evidence/T027/` and commit — reference the repo-local path in Notes, not an external path.

### Stage 4 outcome

- `migration-safety`: **GO** (additive column + enum value, reversible for the column; enum-value removal is a standard accepted Postgres limitation, consistent with every prior enum addition in this codebase).
- `code-review`: **0 P0 / 1 P1 (accepted) / 0 P2 / 0 P3**. The P1 — a deactivated user's still-valid JWT keeps working on non-login routes until natural expiry (`roles.guard.ts` doesn't re-check `isActive` per-request) — was self-flagged by the implementer per the TASK_GUIDE's explicit "Files Must NOT Touch: roles.guard.ts" boundary. Accepted as a tracked fast-follow, not a merge blocker.
- `security-review`: **0 High / 1 Medium (same finding as the P1 above) / 0 Low**. No privilege-escalation, IDOR, injection, or data-exposure issues found. Reports: `reports/code-review_task-T027-team-management-backend_20260714T035000.html`, `reports/security-review_task-T027-team-management-backend_20260714T040000.html`.

---

## Approach

Per the locked brainstorming decision (Option A — extend `UsersController`/`UsersService`):
1. Additive migration: `User.isActive Boolean @default(true)`. Run `Skill({ skill: "migration-safety" })` before merge.
2. `GET /users` — kitchen-scoped (derive `kitchenId` from `req.user.sub` server-side, never a param), `@Roles(OWNER, ADMIN)`, returns active members only.
3. `PATCH /users/:id/role` — validate target role via DTO `@IsEnum` restricted to `CHEF | STAFF | VIEWER` (a narrower enum/union than the full `Role` enum, so OWNER/ADMIN is rejected at the DTO layer, not just a runtime check); verify target user is in caller's kitchen (404 if not) and is not OWNER/ADMIN (403 if so) before updating.
4. `DELETE /users/:id` — same kitchen/role guards as above, plus reject if `:id === req.user.sub` (400). Sets `isActive: false`.
5. Auth: in `AuthService#login` (or wherever credentials are verified), add an `isActive` check — reject with the same generic 401 used for a wrong password (don't leak "this account is deactivated" as a distinct message, matching the existing invite-token not-found-vs-expired pattern of not leaking account state).
6. `GET /users/invites` / `DELETE /users/invites/:id` — kitchen-scoped, `PENDING` status only for the list; pick and document the revoke mechanism (status flip vs. delete).

---

## Edge Case Checklist

- [ ] Owner/Admin cannot change a member's role to Owner/Admin (DTO-level rejection, not just a runtime guard)
- [ ] Owner/Admin cannot remove/deactivate another Owner/Admin (403)
- [ ] A caller cannot remove/deactivate themselves (400)
- [ ] A deactivated user's existing FK references (StockMovement.actorId, Task.assigneeId, Comment.authorId, etc.) remain valid and don't crash on read
- [ ] A deactivated user attempting login gets a generic 401, not a distinct "deactivated" message (don't leak account state)
- [ ] Revoking an already-accepted or already-revoked invite fails gracefully (404/409, not 500)
- [ ] `GET /users` and `GET /users/invites` never leak another kitchen's data (cross-tenant test required)
- [ ] Chef/Staff/Viewer get 403 on all 4 new routes

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `User.isActive Boolean @default(true)` |
| `apps/api/prisma/migrations/<timestamp>_add_user_is_active/migration.sql` | Generated additive migration |
| `apps/api/src/users/users.controller.ts` | 4 new routes |
| `apps/api/src/users/users.service.ts` | 4 new service methods |
| `apps/api/src/users/dto/update-role.dto.ts` (new) | Role-change DTO, restricted enum |
| `apps/api/src/auth/auth.service.ts` | Reject login for `isActive: false` |
| Corresponding `*.e2e.spec.ts` | New tests per Acceptance Criteria |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/auth/guards/roles.guard.ts` | Existing RBAC pattern is correct and sufficient — no change needed |
| Any other feature module's service/controller | Deactivation is enforced only at login, not by touching every module's queries |
| `apps/web/**` | Frontend is T028, blocked on this task's endpoints existing first |

---

## Test Plan

Unit/integration tests covering all 10 Acceptance Criteria: member list scoping, role-change (valid + rejected-to-Owner/Admin + cross-tenant-404 + target-is-Owner/Admin-403), removal (valid + self-403 + Owner/Admin-target-403 + cross-tenant-404), post-removal FK integrity, deactivated-login-401, pending-invite list + revoke + reuse-after-revoke, and a Staff-caller-403 matrix across all 4 routes (per the RBAC "matrix-style tests, not per-task tests" learning from T019). Run full `apps/api` suite after to confirm no regression.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] `Skill({ skill: "migration-safety" })` run — mandatory, this task adds a DB column
- [ ] `Skill({ skill: "security-review" })` run — mandatory, High Risk (RBAC-sensitive)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table (Hard-Stop Gate 5)
- [ ] `Skill({ skill: "verify" })` run — feature confirmed working via live API calls
- [ ] Any external-tool evidence copied into `reports/evidence/T027/` and committed
- [ ] `memory/MEMORY.md` updated (if new patterns or feedback learned)
- [ ] Supervisor notified: task ready for Stage 4 review
