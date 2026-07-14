# BRAINSTORMING_LOG.md
**Generated**: 2026-07-14
**Task / Context**: Team & Roles page — member list, role changes, removal, pending-invite management
**Skill**: `Skill({ skill: "brainstorming" })`

---

## The Problem Space

The sidebar has a "Team & Roles" link (`/team`) that has always rendered the generic empty-state placeholder — there is no team-management UI at all. Backend support is partial: T002 built `POST /users/invite` (create/refresh a pending Invite, Owner/Admin only, grants Chef/Staff/Viewer — Owner/Admin has never had any creation path, a known gap) and `POST /users/invite/accept` (token → new account). There is no endpoint to list a kitchen's members, change a member's role, remove a member, list pending invites, or revoke one.

This is **Standard tier**: moderate ambiguity (RBAC rules for role-change/removal, invite visibility) but a bounded, well-understood CRUD-shaped feature once those are resolved. Resolved via forced choice with the user before this log was written:
- Role changes: Owner/Admin can change a member's role, but only within Chef/Staff/Viewer — Owner/Admin still cannot be granted via role-change (same gap as invite, deliberately not closed in this task).
- Removal: Owner/Admin can remove Chef/Staff/Viewer members only — cannot remove another Owner/Admin, cannot remove self. Removed user's historical data (StockMovement actor, Task assignee, Comment author, etc.) is untouched — only account access is revoked.
- Pending invites: visible on this page with a Revoke action.

---

## Alternative Paths

| Option | Name | Summary | Invasiveness | Code Volume | Regression Risk | Recommended? |
|--------|------|---------|-------------|------------|----------------|--------------|
| A | Extend UsersController | Add member-list/role-change/remove/revoke-invite endpoints to the existing `UsersController`/`UsersService` | Low | ~200 lines | Low | ✅ Yes |
| B | New dedicated TeamController/module | Split team-management into its own NestJS module, separate from the invite/auth-adjacent `UsersController` | Medium | ~300 lines | Low | |
| C | Reuse the Kitchen entity's relation, no new endpoints — frontend queries existing data | Try to avoid new backend work entirely by having the frontend infer team state from data already fetched elsewhere | Low (frontend-only) | ~150 lines | High | |

### Option A — Extend UsersController
**Approach**: Add `GET /users` (kitchen-scoped member list), `PATCH /users/:id/role`, `DELETE /users/:id` (deactivate/remove), `GET /users/invites` (pending invites), `DELETE /users/invites/:id` (revoke) to the existing `users` module — same controller/service that already owns invite creation and acceptance.
**Pros**: All user/membership lifecycle logic stays in one module (matches existing T002 structure — invite creation is already here). No new module wiring in `app.module.ts`. Reuses the established kitchen-scoped-controller pattern (derive caller's own `kitchenId` server-side, never trust a param) already proven across Inventory/Recipes/Guidelines/Tasks.
**Why it might fail**: `UsersController` grows to ~8 routes across 3 concerns (invite, theme, team-management) — a maintainability smell if this module keeps growing, but not a functional risk today.

### Option B — New dedicated TeamController/module
**Approach**: Create `apps/api/src/team/` as its own module for member-list/role-change/remove/invite-management, leaving `UsersController` untouched.
**Pros**: Cleaner separation of concerns long-term.
**Why it might fail**: Splits closely-related logic (invite creation lives in `users`, invite revocation would live in `team`) across two modules for no functional gain — the split doesn't pay for itself at this feature's size. Violates Simplicity First for a codebase this size.

### Option C — Frontend-only, no new endpoints
**Approach**: Avoid new backend routes; try to assemble a member list from data already available to the frontend (e.g. `assigneeId`/`authorId` fields scattered across Tasks/Notes/Comments responses).
**Pros**: Zero backend changes.
**Why it might fail**: There is no existing endpoint that returns the full kitchen roster — assembling one from scattered foreign-key references is fragile (a kitchen member who authored nothing would never appear), can't support role-change/removal/invite-revoke at all (no backend mutation path), and is a workaround, not a real implementation. Rejected outright.

---

## 50% Rule Check

Option A's ~200 lines is already lean — 4 new routes (list/role-change/remove/revoke) plus 1 already-existing (invite). No new abstraction layer, no new module. The one place volume could balloon is over-designing the "remove" semantics (soft-delete flag vs. hard delete vs. deactivate-boolean) — kept to the simplest safe shape: deactivate via a boolean flag (preserves FK integrity for historical StockMovement/Task/Comment references) rather than a hard `DELETE`, which would either cascade-destroy history or require nullable FKs everywhere it doesn't already have them.

---

## Recommended Path

**Option A — Extend UsersController**

Matches the codebase's existing structure exactly (T002 already put invite logic here), avoids a needless module split, and every new route reuses the kitchen-scoped-controller + `RolesGuard`/`@Roles()` pattern already proven across 8+ prior tasks.

---

## Surgical Scope

Files that **should** be touched:
- `apps/api/src/users/users.controller.ts` — new routes: `GET /users`, `PATCH /users/:id/role`, `DELETE /users/:id`, `GET /users/invites`, `DELETE /users/invites/:id`
- `apps/api/src/users/users.service.ts` — corresponding service methods
- `apps/api/src/users/dto/` — new DTOs (`update-role.dto.ts`)
- `apps/api/prisma/schema.prisma` — additive `User.isActive Boolean @default(true)` (soft-removal flag; deactivated users can't log in but their historical FK references remain valid)
- `apps/api/src/auth/auth.service.ts` / login guard — reject login for a deactivated (`isActive: false`) user
- `apps/web/src/features/team/` (new) — `TeamPage.tsx`, member list, invite form, pending-invites list, role-change control, remove action
- `apps/web/src/App.tsx` — wire `/team` to the real page (replacing the generic `SectionPage` placeholder)

Files that **must not** be touched:
- `apps/api/src/auth/guards/roles.guard.ts` — the existing DB-current-role RBAC pattern is correct and sufficient; no change needed
- Any other feature module (Tasks/Notes/Comments/etc.) — deactivation is enforced only at login, not by touching every module's queries

---

## Edge Case Checklist for TASK_GUIDE

- [ ] Owner/Admin cannot change a member's role to Owner/Admin (locked decision — the invite-time gap stays a gap)
- [ ] Owner/Admin cannot remove/deactivate another Owner/Admin (prevents accidental kitchen lockout)
- [ ] A caller cannot remove/deactivate themselves via this endpoint
- [ ] A deactivated user's existing `StockMovement`/`Task.assigneeId`/`Comment.authorId` etc. references remain valid and don't crash on read (soft-delete, not hard delete)
- [ ] A deactivated user attempting to log in gets a clear 401, not a confusing generic error
- [ ] Revoking a pending invite that's already been accepted (race) fails gracefully, not a 500
- [ ] Member-list endpoint is kitchen-scoped (never leaks another kitchen's roster) — same cross-tenant pattern as every other module
- [ ] Chef/Staff/Viewer cannot access any of the new mutation routes (403) — matches FR-018's Owner/Admin-only team-management framing

---

## Next Actions

1. Add FR-026/US-015 to `PRD.md` for traceability (post-MVP feature, same pattern as FR-025/US-014 for theme system).
2. Stage 2 `/plan`: split into a backend slice (member-list/role-change/remove/invite-management endpoints + `isActive` migration, C2/**High Risk** — RBAC-sensitive, mirrors T002/T019's classification, needs `security-review` + `migration-safety`) and a frontend slice (Team & Roles page UI, C2/Medium Risk, blocked by backend).

---

## User Selection

> **Approved direction**: Option A — Extend UsersController
> Approved by user on 2026-07-14 (via role-change/removal/pending-invite Q&A during brainstorming).
