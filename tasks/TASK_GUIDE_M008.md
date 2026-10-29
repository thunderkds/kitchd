# TASK_GUIDE — M008: Notification centre (unread badge, list, mark-read)
**Date**: 2026-10-29
**Complexity Level**: C1
**Risk Level**: Low
**Priority**: P1
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-102

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/components/NotificationBell/NotificationBell.tsx`, `NotificationBell/api.ts`
4. Read the API controller/DTO for every route you call: `apps/api/src/notifications/notifications.controller.ts`
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> Mobile users see an unread-count badge on the dashboard, open a notifications screen listing their notifications, and mark them read — parity with the web bell.

**Out of scope**: push notifications (APNs/FCM, `expo-notifications`) — a separate, much larger task needing credentials; realtime refresh of the badge (M009). Foreground refetch via TanStack `focusManager` (M004) is enough.

---

## Dependencies & Reachability

**Depends on**: M004
**Entry point**: `apps/mobile/app/dashboard.tsx` badge → `app/notifications.tsx`
**Consumer**: every signed-in user

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | Dashboard shows an unread count from `GET /notifications` (hidden when 0) | M008 |
| 2 | `app/notifications.tsx` lists notifications with read/unread state and an empty state | M008 |
| 3 | Mark-read calls `POST /notifications/mark-read` with the body shape the controller expects (same as web), then invalidates the notifications query so the badge updates | M008 |
| 4 | Tests: badge count/hidden-at-0, list + empty state, mark-read payload + invalidation | test-first |
| 5 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m008-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M008.md`.

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
