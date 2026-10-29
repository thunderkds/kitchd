# TASK_GUIDE — T050: Extend the RBAC matrix audit to the `/users` routes
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Medium
**Priority**: P2
**Assigned agent**: backend-developer
**Agent guide**: `agents/backend-implementer.md`
**Linear**: HUN-94

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md` + `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md` (entries: "Central RBAC matrix audit covers no `/users` route", "RolesGuard: DB-current role, 404-not-403 cross-tenant")
3. Read this file completely
4. Read `agents/backend-implementer.md`

---

## Requirement (Pillar 1 - Adapt the requirement)

Origin: T040 Stage 4 P2 finding.

**Restated intent**:
> `apps/api/src/rbac-audit/rbac-matrix.e2e.spec.ts` must assert the role matrix for every `/users` route, so that a future role omission on those routes fails the central audit instead of slipping through.

**Out of scope**:
- Changing any `@Roles(...)` decorator or guard. If the test reveals a route whose current behaviour contradicts the decorator, **stop and report** — do not "fix" production code in this task.
- Tests for invite-accept business rules (already covered by `users-invite.e2e.spec.ts`)

**Requirement Refs**:
- KANBAN T050 row

### Requirement Fidelity Gate

- [x] Restated intent matches the KANBAN row
- [x] Every Acceptance Criterion traces to the Requirement

---

## Dependencies & Reachability

**Depends on**: none

**Entry point**: `rbac-matrix.e2e.spec.ts` (test-only task)

**Consumer**: `pnpm --filter @kitchenos/api test`

---

## Route matrix to encode (from `apps/api/src/users/users.controller.ts`)

| Route | Allowed (2xx) | Denied (403) |
|-------|---------------|--------------|
| `POST /users/invite` | OWNER (ADMIN) | CHEF, STAFF, VIEWER |
| `GET /users/invites` | OWNER (ADMIN) | CHEF, STAFF, VIEWER |
| `DELETE /users/invites/:id` | OWNER (ADMIN) | CHEF, STAFF, VIEWER |
| `GET /users/assignable` | OWNER, CHEF (ADMIN) | STAFF, VIEWER |
| `GET /users` | OWNER (ADMIN) | CHEF, STAFF, VIEWER |
| `PATCH /users/:id/role` | OWNER (ADMIN) | CHEF, STAFF, VIEWER |
| `DELETE /users/:id` | OWNER (ADMIN) | CHEF, STAFF, VIEWER |
| `PATCH /users/me/theme` | all 4 roles (no `@Roles`) | — |
| `POST /users/invite/accept` | public | — (not role-gated; out of the matrix) |

ADMIN cannot be created through any code path today (memory: Admin-role-unreachable), so ADMIN is listed but not exercised — say so in a test comment, matching the Announcements block's precedent.

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | A new `describe('Users module matrix')` block asserts 2xx for every allowed role and 403 for every denied role, for every role-gated route in the table above | "assert the role matrix for every `/users` route" |
| 2 | `PATCH /users/me/theme` is asserted 200 for all 4 roles | same |
| 3 | The `unauthenticated request is 401` test includes at least `GET /users` and `PATCH /users/me/theme` | same |
| 4 | A cross-kitchen check: an Owner of kitchen B gets 404 (not 403, not 200) on `PATCH /users/:id/role` and `DELETE /users/:id` for a user of kitchen A | RolesGuard 404-not-403 decision |
| 5 | Mutation check: temporarily removing `Role.CHEF` from `GET /users/assignable`'s `@Roles` makes the new block fail; restored afterwards (record it in the report, do not commit the mutation) | "fails the central audit" |

---

## Evaluation & Acceptance

### Verification Command (exact, runnable)

```bash
docker start kitchenos-postgres >/dev/null; cd apps/api && npx jest src/rbac-audit/rbac-matrix.e2e.spec.ts && npx jest
```

### Evidence

> Filled by the reviewer in `tasks/TASK_REVIEW_T050.md`.

---

## Approach

Reuse the existing helpers in the spec (`buildRoleSet`, `inviteAndAccept`, `signupOwner`). Destructive routes (`DELETE /users/:id`, `PATCH /users/:id/role`, `DELETE /users/invites/:id`) need a fresh target per allowed-role assertion so one 2xx doesn't break the next assertion — create targets via `inviteAndAccept` / `POST /users/invite`. Match the existing block style (one `it` per verb group, Owner/Chef/Staff/Viewer loops).

**Cut list**: no new helper files; no refactor of existing blocks; update the file's top comment to say `/users` is now covered.

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `apps/api/src/rbac-audit/rbac-matrix.e2e.spec.ts` | new Users block + 401 additions + header comment |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/src/users/*.ts` | test-only task; production changes need a separate decision |
| `apps/api/src/auth/**` | auth boundary |

---

## Completion Checklist

- [ ] Tests written AND pass
- [ ] Full API suite green
- [ ] Mutation check recorded
- [ ] Supervisor notified: task ready for Stage 4 review
