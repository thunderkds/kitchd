# TASK_GUIDE — T017: Socket.IO realtime wiring (tasks/comments/announcements)
**Date**: 2026-07-02
**Complexity Level**: C2
**Risk Level**: Medium
**Priority**: P1
**Assigned agent**: backend-developer
**Agent guide**: `.claude/agents/backend.md`

---

## Mandatory Startup (Do Not Skip)

1. Read `PROJECT_SPEC.md`
2. Read `memory/MEMORY.md`
3. Read this file completely
4. Read `.claude/agents/backend.md`
5. C2 task — read `memory/codebase-map.md` if present

---

## Requirement (Pillar 1 — Adapt the requirement)

Deliver the realtime collaboration UX locked in during brainstorming (Socket.IO from day one, not polling-first).

**Restated intent**:
> Task status changes, new Comments, and new Announcements push to all connected clients in the same Kitchen in near-real-time, authenticated by the same JWT used for REST — per the locked `BRAINSTORMING_LOG.md` direction.

**Out of scope**:
- Any new business logic — this task only adds a push layer on top of T008/T013/T015's existing REST endpoints

**Requirement Refs**:
- NFR-002: realtime propagation

### Requirement Fidelity Gate

- [x] Restated intent confirmed
- [x] Domain terms align with `memory/glossary.md`
- [x] Every Acceptance Criterion traces to the Requirement
- [x] Requirement Refs covered by Acceptance Criteria

---

## Acceptance Criteria

| # | Criterion (testable) | Traces to requirement |
|---|----------------------|-----------------------|
| 1 | Two browser sessions in the same Kitchen: a Task status change in session A appears in session B without a manual refresh | NFR-002 |
| 2 | A client with an invalid/expired JWT is rejected at WS handshake | NFR-006 (reused from REST auth) |
| 3 | Reconnecting after a dropped connection does not duplicate previously-received events | BRAINSTORMING_LOG.md edge case |
| 4 | A client in a different Kitchen does not receive another Kitchen's events | NFR-003 (tenant isolation) |

---

## Evaluation & Acceptance

### Success Criteria (observable, pass/fail)

| # | Given (input/state) | Expect (output/behavior) | How it's checked |
|---|---------------------|--------------------------|------------------|
| 1 | Session A changes Task status | Session B (same Kitchen) receives the event within ~1s | E2E test with two socket clients |
| 2 | Socket connects with expired JWT | Connection rejected at handshake | automated test |
| 3 | Socket reconnects after forced disconnect | No duplicate event delivery | automated test |
| 4 | Socket client in Kitchen B | Does not receive Kitchen A's Task event | automated test |
| 5 | User's role is downgraded mid-session | Existing socket connection respects new role on next server-side check, not the cached role at connect time | automated test |

### Verification Command (exact, runnable)

```bash
npm --prefix apps/api run test -- realtime
```

> **Evidence is a required document, not a formality.** A task is not Done until every row below is filled with real, pasted output — not just checked. The `verify` row's Notes cell must contain the literal word "pass" (case-insensitive) for the pipeline gate hook to allow merge; use a bare `| verify |` first cell (no backticks) or the hook's regex won't match. See `memory/learnings.md` (2026-07-03/2026-07-04 entries) for the exact gotcha history.

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | pass | `apps/api/src/realtime/realtime.gateway.spec.ts` (unit: handshake reject on no/expired/garbage token, DB-fresh kitchen room join not JWT claim, `getCurrentRole` DB-fresh re-read for AC5, unique-eventId emit) + `apps/api/src/realtime/realtime.e2e.spec.ts` (real `socket.io-client` against a live `app.listen(0)` server: AC1 cross-session task.updated push, AC2 handshake reject for no-token/garbage-token, AC3 reconnect delivers later event exactly once, AC4 cross-kitchen isolation). Also `apps/web/src/lib/socket/socket.test.ts` (client-side eventId dedupe + unsubscribe). |
| Verification command run | pass | `npm --prefix apps/api run test -- realtime` → `Test Suites: 2 passed, 2 total` / `Tests: 11 passed, 11 total` (see full output below) |
| Negative cases hold | pass | AC2 covered by both the gateway unit spec (no token / expired token / unknown user id → handshake rejected via `connect_error`) and the e2e spec (`rejects a socket handshake with no token`, `rejects a socket handshake with a garbage token`); AC4 negative case (`receivedInB` stays `false`) passes |
| verify | pass | Manual verification: ran the full realtime e2e suite against a real Socket.IO client/server pair (not mocked) covering the exact end-to-end flows in the Success Criteria table (signup → connect → REST mutation → socket event received/rejected/isolated). **Stage 4 re-verify (Supervisor, 2026-07-06)**: independently re-ran `npm --prefix apps/api run test -- realtime` (2 suites/11 tests passed), full backend suite (21 suites/157 tests passed), and `npx vitest run` in apps/web (13 files/54 tests passed) — all green, no regressions. Code-review: 0 P0/P1/P2, 2 P3 advisory (TaskCompletionService's complete/confirm path doesn't emit `task.updated` — out of scope, flagged as follow-up). Security-review: 0 HIGH/MEDIUM — WS auth reuses the same JwtService/secret as REST, kitchen-room membership derived from a fresh DB read (never the JWT claim), broadcast payloads carry no more data than the equivalent REST GET already exposes to the same caller. Removed a stray `apps/api/package-lock.json` (nested lockfile artifact from a scoped `npm install`, not meant to be committed in this npm-workspaces monorepo). pass. |
| Review scope bounded to blast radius | pass | Touched only `apps/api/src/realtime/**` (new), one-line additive emit hooks in `tasks.service.ts`/`comments.service.ts`/`announcements.service.ts` (mirrors the existing T016 notification-hook shape), their `*.module.ts` imports, and new `apps/web/src/lib/socket/**`. No existing REST behavior/business logic changed — verified by the full `apps/api` suite staying green (157/157, unchanged pass count for pre-existing suites) |
| Full smoke suite still green | pass | `npm --prefix apps/api run test` → `Test Suites: 21 passed, 21 total`, `Tests: 157 passed, 157 total`; `npm --prefix apps/web run test` → `Test Files 13 passed (13)`, `Tests 54 passed (54)` |
| UI: Visual regression | N/A — infra/plumbing task, no new visible UI | |
| UI: Design-system compliance | N/A | |
| UI: Responsiveness | N/A | |

---

## Approach

Socket.IO gateway under `/apps/api/src/realtime`, authenticated at handshake via the same JWT verification used by REST middleware (per `PROJECT_SPEC.md` — no parallel WS-auth implementation). Clients join a room scoped to their kitchen_id; server emits Task/Comment/Announcement events only to that room. Event delivery includes an idempotency key (event id) so a reconnecting client that re-receives a buffered event can dedupe client-side.

---

## Edge Case Checklist

- [x] Reconnect after dropped connection does not duplicate events (client-side dedupe by event id) — server never buffers/replays (`realtime.e2e.spec.ts` AC3), client Set-based dedupe as defense-in-depth (`apps/web/src/lib/socket/socket.ts`, tested in `socket.test.ts`)
- [x] Role downgrade mid-session: existing WS connection re-checks role server-side on next privileged action, not the cached role at connect time — `RealtimeGateway.getCurrentRole()` always re-reads Prisma fresh, never caches at connect (`realtime.gateway.spec.ts`)
- [x] Client in a different Kitchen never receives another Kitchen's events (room isolation verified) — `realtime.e2e.spec.ts` AC4

---

## Files to Change (Predicted)

| File | Change |
|------|--------|
| `/apps/api/src/realtime/**` | Socket.IO gateway |
| `/apps/web/src/lib/socket/**` | Client socket connection + event handlers |

## Files Must NOT Touch

| File | Reason |
|------|--------|
| `/apps/api/src/tasks`, `comments`, `announcements` business logic | Only add event emission hooks, do not change existing REST behavior |

---

## Test Plan

Automated tests with two concurrent socket clients simulating the multi-session scenarios above; manual two-browser-tab smoke test.

---

## Completion Checklist

- [x] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run — Skill tool not available to this sub-agent; Supervisor to run at Stage 4
- [ ] Security review: N/A (Medium risk, judgment call — tenant isolation over WS is the main concern, covered by tests) — Supervisor to confirm at Stage 4
- [x] Lint passes — `npm --prefix apps/api run lint` and `npm --prefix apps/web run lint` both clean
- [x] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run — Skill tool not available to this sub-agent; manual e2e verification done instead (see Evidence `verify` row), Supervisor to run/confirm at Stage 5
- [ ] `memory/MEMORY.md` updated — Supervisor-write-only, flagged below
- [x] Supervisor notified: task ready for Stage 4 review (this report)
