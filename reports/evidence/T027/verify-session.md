# T027 Verify Evidence — live API session

Server started via `PORT=3027 npm run start:dev` inside `.claude/worktrees/T027/apps/api`.

## Session (Owner + Staff, one kitchen)

1. `POST /auth/signup` — Owner account created (org + kitchen).
2. `POST /users/invite` (Owner) — Staff invited. `POST /users/invite/accept` — Staff account created.
3. `GET /users` (Owner) → 200, list includes both Owner and Staff.
4. `PATCH /users/:staffId/role {"role":"CHEF"}` (Owner) → 200, role updated to CHEF.
5. `PATCH /users/:staffId/role {"role":"OWNER"}` (Owner) → **400** — `"role must be one of the following values: CHEF, STAFF, VIEWER"` (DTO-level rejection).
6. `GET /users` as the Staff/Chef member's own token → **403** — `"Insufficient role for this action"`.
7. `DELETE /users/:ownerId` (Owner removing self) → **400** — `"Cannot remove yourself"`.
8. `DELETE /users/:staffId` (Owner deactivating the Chef member) → 200, response shows `"isActive":false`.
9. Deactivated user attempts `POST /auth/login` with correct password → **401** — `"Invalid credentials"` (same generic message as wrong password, no account-state leak).
10. `GET /users/invites` (Owner) → 200, `[]` (the earlier invite was already ACCEPTED, correctly excluded from the PENDING list).
11. New invite created, then `DELETE /users/invites/:id` (Owner revokes) → 200, `"status":"REVOKED"`.
12. Revoked invite's token used against `POST /users/invite/accept` → **404** — `"Invite not found or already used"` (graceful, not 500).

## Cross-tenant probe (separate Owner/kitchen)

13. A second Owner (different org/kitchen) attempts `PATCH /users/:randomId/role` → **404** — `"User not found"` (not 403 — matches the established kitchen-scoped-controller pattern; never confirms existence of a cross-tenant id).

## Automated test run

```
$ cd apps/api && npm test -- team
PASS src/users/team.e2e.spec.ts
  Team management (e2e)
    ✓ AC1: Owner can list own kitchen active members, never another kitchen
    ✓ AC2: Owner changes a Staff member role to CHEF
    ✓ AC2: requesting OWNER as new role is rejected with 400 (DTO-level)
    ✓ AC2: requesting ADMIN as new role is rejected with 400 (DTO-level)
    ✓ AC3: role-change targeting a different kitchen returns 404, not 403
    ✓ AC3: remove targeting a different kitchen returns 404, not 403
    ✓ AC4: Admin cannot change another Owner's role (403)
    ✓ AC4: Admin cannot remove/deactivate an Owner (403)
    ✓ AC5: Owner cannot remove themselves (400)
    ✓ AC6/AC7: DELETE soft-deactivates (isActive:false, row intact), FK refs valid, login rejected 401
    ✓ AC8: GET /users/invites lists only own kitchen PENDING invites
    ✓ AC9: revoking a pending invite prevents its later acceptance
    ✓ AC9: revoking an already-revoked invite fails gracefully (409, not 500)
    ✓ AC9: revoking an already-accepted invite fails gracefully (409, not 500)
    ✓ AC9: revoking a nonexistent invite id returns 404, not 500
    ✓ AC10: Chef/Staff/Viewer are rejected with 403 on all 4 new routes

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

## Full regression suite

```
$ npm test
Test Suites: 25 passed, 25 total
Tests:       202 passed, 202 total
```
