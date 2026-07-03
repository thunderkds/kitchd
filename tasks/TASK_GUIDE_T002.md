# TASK_GUIDE — T002: Org/Kitchen/User invite flow + RBAC guard
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: High
**Priority**: P0
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C2 task — read `memory/codebase-map.md` if present, else skim `/apps/api/src/auth` from T001

---

## Requirement (Pillar 1 — Adapt the requirement)

Build the invite flow and — critically — the single reusable RBAC enforcement mechanism every future module must use.

**Restated intent**:
> An Owner/Admin can invite a user to their Kitchen with a specific role; every protected route in the system enforces role access through one shared `RolesGuard` + `@Roles()` decorator, never an ad-hoc per-route check.

**Out of scope**:
- Any domain-entity CRUD (Recipe, Task, Inventory, etc.) — those consume this guard in later tasks
- Email delivery for invites (store invite state; actual email sending is out of scope for local-dev MVP)

**Requirement Refs**:
- FR-018: role-based permissions (Owner/Admin, Chef, Staff, Viewer)
- NFR-003: multi-tenant Organization → Kitchen → User
- NFR-006: JWT-based auth
- US-010

### Requirement Fidelity Gate (sign off BEFORE implementation)

- [x] Restated intent confirmed to match the user's request
- [x] Domain terms align with `memory/glossary.md` (Kitchen, User, roles)
- [x] Every Acceptance Criterion below traces to a line in the Requirement
- [x] All Requirement Refs exist in `PRD.md` and are covered by the Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Owner can invite a user by email to their Kitchen with a role (Chef/Staff/Viewer) | FR-018, US-010 |
| 2 | Invited user, once accepted, has access scoped to only that Kitchen | NFR-003 |
| 3 | A route protected with `@Roles('chef')` rejects a Staff-role JWT with 403 | FR-018 |
| 4 | `RolesGuard` is the only permission-check mechanism in the codebase (no inline role checks) | FR-018 — enforced as an architectural constraint per `PROJECT_SPEC.md` |
| 5 | Viewer role can read but not write on any guarded route | FR-018 |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Owner POSTs an invite for a new email + role=chef | Invite record created, invite-accept flow works | automated test |
| 2 | Staff JWT calls an `@Roles('chef')` endpoint | 403 | automated test |
| 3 | Viewer JWT calls a write endpoint | 403 | automated test |
| 4 | `grep -r` for inline `req.user.role ===` outside the guard | No matches | manual grep, pasted in evidence |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- rbac invite
```

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/api/src/auth/guards/roles-rbac.guard.spec.ts` (unit: allow when unguarded, allow/deny by DB-current role, 403 on removed user, 403 unauthenticated), `apps/api/src/users/users-invite.e2e.spec.ts` (invite creation, accept flow + kitchen scoping, 403 non-owner/admin, 401 unauthenticated, 409 re-invite existing member, idempotent pending re-invite, expired-invite rejection), `apps/api/src/kitchens/kitchens-rbac.e2e.spec.ts` (Staff 403 / Chef 200 on `@Roles(CHEF)`, Viewer read-allowed/write-403, revoked-user 403, unauthenticated 401, cross-kitchen 404 on GET/PATCH) |
| Verification command run | ☑ pass | `npm --prefix apps/api run test -- rbac invite` → `Test Suites: 3 passed, 3 total`, `Tests: 21 passed, 21 total` |
| Negative cases hold | ☑ pass | 403 on insufficient role, 401 unauthenticated, 404 on cross-kitchen access, 404 on expired/used invite, 409 on duplicate member invite — all covered above |
| verify | ☑ pass | Real NestJS server driven live via curl (signup→invite→accept→RBAC-gated PATCH/GET, plus 4 adversarial probes: cross-kitchen 404, invite-reuse 404, privilege-escalation 403, unauthenticated 401) — all held. See PASS verification report in Stage 5 conversation log. |
| Review scope bounded to the change's blast radius | ☑ pass | Stage 4 code-review scoped to `apps/api/src/auth/**`, `apps/api/src/users/**`, `apps/api/src/kitchens/**`, `apps/api/prisma/**` — matched the diff's actual footprint |
| Full smoke suite still green (no regression) | ☑ pass | `npm --prefix apps/api run test` (full suite) → `Test Suites: 6 passed, 6 total`, `Tests: 32 passed, 32 total` |
| UI: Visual regression | ☑ N/A — pure backend task | |
| UI: Design-system compliance | ☑ N/A — pure backend task | |
| UI: Responsiveness | ☑ N/A — pure backend task | |
| **AC4 grep check** | ☑ pass | `grep -rn ".role ===" src --include="*.ts"` → only match is a code comment inside `roles.guard.ts` explaining the constraint; no inline role checks anywhere else |

---

## Approach

Implement `RolesGuard` as a NestJS `CanActivate` guard reading `req.user.role` (set by the JWT strategy from T001) plus the target Kitchen scope, paired with a `@Roles(...)` decorator applied per-route/controller. This guard is the ONE enforcement point per `PROJECT_SPEC.md` Critical Constraints — every subsequent task (T004 onward) must reuse it, never reimplement. Invite flow: an `Invite` record (email, kitchen_id, role, status) created by Owner/Admin; an accept endpoint that, given a valid invite token and a signup/login, attaches the User to that Kitchen with the specified role.

---

## Edge Case Checklist

- [ ] Invite to a non-existent Kitchen is rejected
- [ ] Re-inviting an already-member user is handled gracefully (no duplicate membership)
- [ ] A Staff JWT attempting to call an Admin-only endpoint directly is blocked by the guard, not by client-side hiding alone
- [ ] A JWT for a user removed from the Kitchen after token issuance is rejected on next guarded call (role re-checked against current DB state, not just JWT claims)

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/auth/guards/roles.guard.ts` | New — the shared RolesGuard |
| `/apps/api/src/auth/decorators/roles.decorator.ts` | New — `@Roles()` decorator |
| `/apps/api/src/users/**` | Invite flow, membership |
| `/apps/api/src/kitchens/**` | Kitchen-scoped membership |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/recipes`, `inventory`, `tasks` | Don't exist yet — out of scope |

---

## Test Plan

Automated tests: invite creation, invite accept, RolesGuard positive/negative cases per role, cross-Kitchen isolation. Manual: grep for inline role checks.

---

## Completion Checklist

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: `Skill({ skill: "security-review" })` run (High risk — mandatory)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
