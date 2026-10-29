# TASK_GUIDE — M017: Team management + "I have an invite" entry on login
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-112

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/features/team/TeamPage.tsx` + `team/api.ts` (role change, remove, self/owner guards), `apps/web/src/routes/pages/LoginPage.tsx` (invite entry, T043)
4. Read the API controller/DTO for every route you call: `apps/api/src/users/users.controller.ts` (`PATCH /users/:id/role`, `DELETE /users/:id`, `@Roles(OWNER, ADMIN)`), `dto/update-role.dto.ts`, `users.service.ts` guards
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> OWNER/ADMIN can change a member's role and remove a member from `app/team.tsx`; a signed-out invitee can reach invite acceptance from the login screen without the deep link.

**Risk Medium** because it touches RBAC-gated user management: client guards must mirror the service's rules (e.g. can't demote/remove yourself or the OWNER — read `users.service.ts`), but the server stays the authority. Destructive remove needs a confirm `Alert`.

---

## Dependencies & Reachability

**Depends on**: M004
**Entry point**: `apps/mobile/app/team.tsx`; `apps/mobile/app/index.tsx` → `/invite/accept`
**Consumer**: OWNER/ADMIN (team); signed-out invitee (login entry)

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Role picker per member (OWNER/ADMIN only) calls `PATCH /users/:id/role` with a role from the DTO enum; hidden/disabled where web hides it (self, OWNER row — match web + service) | M017 |
| 2 | Remove member asks for confirmation, then `DELETE /users/:id`; list refreshes; server error shown | M017 |
| 3 | Non-OWNER/ADMIN never sees the controls | M017 |
| 4 | Login screen has an "I have an invite" link to `/invite/accept` where the token can be pasted (works signed-out) | M017 |
| 5 | Tests: control visibility by role and target, role mutation payload, remove requires confirm, login link navigates | test-first |
| 6 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m017-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M017.md`.

---

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `apps/api/**`, `apps/web/**`, `packages/shared/**` | out of scope — mobile consumer only; if the API is missing something, STOP and report |

---

## Completion Checklist

- [ ] Tests first (paste failing output)
- [ ] Verification command passes (`exit=0`, typecheck, export)
- [ ] Supervisor notified: ready for Stage 4
