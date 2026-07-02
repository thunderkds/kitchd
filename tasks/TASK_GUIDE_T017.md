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

### Evidence (filled by reviewer at Stage 4/5)

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☐ pass / ☐ fail | |
| Verification command run | ☐ pass / ☐ fail | |
| Negative cases hold | ☐ pass / ☐ fail | |
| `verify` skill — works in running app | ☐ pass / ☐ fail | |
| Review scope bounded to blast radius | ☐ pass / ☐ fail | |
| Full smoke suite still green | ☐ pass / ☐ fail | |
| UI: Visual regression | ☐ N/A — infra/plumbing task, no new visible UI | |
| UI: Design-system compliance | ☐ N/A | |
| UI: Responsiveness | ☐ N/A | |

---

## Approach

Socket.IO gateway under `/apps/api/src/realtime`, authenticated at handshake via the same JWT verification used by REST middleware (per `PROJECT_SPEC.md` — no parallel WS-auth implementation). Clients join a room scoped to their kitchen_id; server emits Task/Comment/Announcement events only to that room. Event delivery includes an idempotency key (event id) so a reconnecting client that re-receives a buffered event can dedupe client-side.

---

## Edge Case Checklist

- [ ] Reconnect after dropped connection does not duplicate events (client-side dedupe by event id)
- [ ] Role downgrade mid-session: existing WS connection re-checks role server-side on next privileged action, not the cached role at connect time
- [ ] Client in a different Kitchen never receives another Kitchen's events (room isolation verified)

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

- [ ] Implementation done
- [ ] Self-review: `Skill({ skill: "code-review" })` run
- [ ] Security review: N/A (Medium risk, judgment call — tenant isolation over WS is the main concern, covered by tests)
- [ ] Lint passes
- [ ] Tests written AND pass — output pasted into Evidence table
- [ ] `Skill({ skill: "verify" })` run
- [ ] `memory/MEMORY.md` updated
- [ ] Supervisor notified: task ready for Stage 4 review
