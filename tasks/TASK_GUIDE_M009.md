# TASK_GUIDE — M009: Socket.IO realtime with foreground reconnect
**Date**: 2026-10-29
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P2
**Assigned agent**: mobile-developer
**Board**: `PROJECT_KANBAN_mobile.md`
**Linear**: HUN-103

> Read relevant files from `docs/legacy/` before making any code changes. (This project has no `docs/legacy/`; `PROJECT_SPEC.md`, `RN_MIGRATION_ROADMAP.md` and `memory/MEMORY.md` are its equivalent.)

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md` and this file completely
2. Read `docs/audits/backend-mobile-coverage_2026-10-29.md` (route table, roles)
3. Read the web reference implementation(s) for parity: `apps/web/src/lib/socket/socket.ts` (+ its test), and its subscribers (`grep -rn "socket" apps/web/src --include=*.tsx`)
4. Read the API controller/DTO for every route you call: `apps/api/src/realtime/realtime.gateway.ts` (JWT handshake, kitchen rooms, events `task.updated`, `comment.created`, `announcement.created`)
5. Mobile conventions: server state via TanStack Query (`src/queryClient.ts`, `src/queryKeys.ts` — added by M004); fetch layer `src/api.ts`; forms per M005 (`src/schemas/`) if it has landed

---

## Requirement (Pillar 1 - Adapt the requirement)

**Restated intent**:
> Mobile receives the three realtime events and invalidates the matching TanStack queries, connecting with the session JWT, disconnecting on background/logout and reconnecting on foreground.

**CORS note (M011 open question)**: the gateway's `cors.origin` is `WEB_ORIGIN`. CORS is enforced by browsers only; a native Socket.IO client sends no `Origin`, so it is not blocked. Expo-web *would* be. Verify by connecting a node `socket.io-client` without an Origin header to the local API and record the result; do NOT change the API.

**Out of scope**: optimistic updates; offline queueing.

---

## Dependencies & Reachability

**Depends on**: M004 (queries to invalidate), M007 (comment query key) — if M007 hasn't landed, invalidate a `['comments']` key prefix anyway
**Entry point**: `apps/mobile/src/realtime.ts`, started from `app/_layout.tsx` after `sessionReady` when a token exists
**Consumer**: every signed-in user (lists refresh live)

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to |
|---|----------------------|-----------|
| 1 | `socket.io-client` (version matching the API's `socket.io` major) added; `src/realtime.ts` connects with the same auth handshake as web (`auth: { token }` or as the gateway reads it) | M009 |
| 2 | `task.updated` → invalidate tasks + that task; `comment.created` → invalidate comments; `announcement.created` → invalidate announcements | M009 |
| 3 | `AppState` background → disconnect; active → reconnect; logout (`clearSession` path) → disconnect and never reconnect with the old token | M009 |
| 4 | Tests with a mocked `socket.io-client`: handshake carries the token, each event invalidates the right keys, AppState transitions, logout disconnects | test-first |
| 5 | Evidence: a node script connects to the local API without an `Origin` header and receives a `task.updated` after a `PATCH /tasks/:id` (paste output) | M009 |
| 6 | mobile test (`exit=0`) + typecheck + export pass | no regression |

---

## Verification Command (exact, runnable)

```bash
pnpm install --frozen-lockfile && pnpm --filter @kitchenos/mobile test; echo "exit=$?"; pnpm --filter @kitchenos/mobile typecheck && pnpm --filter @kitchenos/mobile exec expo export --platform ios --output-dir /tmp/m009-export
```
The test command MUST print `exit=0`. Device verification is not available here (no simulator) — record as a pending human device check. If the API is running locally (`:3000`), additionally exercise the routes with `curl` and paste the responses.

### Evidence
> Filled by the reviewer in `tasks/TASK_REVIEW_M009.md`.

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
