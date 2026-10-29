# TASK_REVIEW — M009: Socket.IO realtime with foreground reconnect

> Sibling of `tasks/TASK_GUIDE_M009.md`. Filled by the Supervisor, 2026-10-29. Commits `0a70b2b`, `c2214d1` (task/M009), review fixes `231bd1a` (integ/wave3). Reviewer: independent qa-expert (code + security, socket.io-client 4.8.3 source read).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Gateway CORS (`WEB_ORIGIN`) does NOT block native clients — FACT: Supervisor rerun of the AC5 script below: Origin-less client connects (polling+upgrade and websocket-only) and receives `task.updated`; bad token → `Unauthorized`. Expo-web (browser) would still be CORS-bound — not a target.
2. Disconnect on `background` only, not `inactive` — FACT: iOS reports `inactive` for Control Center / app-switcher peeks; disconnecting there churned the socket.
3. Catch-up `invalidateQueries()` on every reconnect except a session's first connect — FACT: the server does not replay missed events.
4. Session change reaches realtime via a `storage.ts` subscriber (`onSessionChange`), notified before the awaited SecureStore writes — FACT: avoids a storage→realtime→session→storage import cycle; socket closes even if keychain delete rejects.
5. `connect_error` tears down and nulls the socket so the next `active` rebuilds it (review P2) — FACT: socket.io destroys the socket internally on a CONNECT_ERROR packet; our reference stayed non-null and realtime was dead until backgrounded. No in-handler retry loop.
Checks: review — pass (0 P0/P1; 2 P2 fixed); security — PASS (fresh token per handshake, no post-logout reconnect, no cross-user room leak); 11/12 mutants killed, 12th killed after fix
Not done: expo-web realtime; device check pending (no simulator)

## AC5 evidence (Supervisor rerun, local API :3000)

```
[polling+upgrade (default)] signup -> 201, token present: true
[polling+upgrade (default)] POST /tasks -> 201 id=38ee3efe-c73e-4fe5-b3c3-8cc6ece72a05
[polling+upgrade (default)] connected id=Ltaxr46tWgLmm_fQAAAJ transport=websocket (no Origin header sent)
[polling+upgrade (default)] RECEIVED task.updated eventId=b98a1dd7-a3ee-4544-a785-4994e30f84c5 task.id=38ee3efe-c73e-4fe5-b3c3-8cc6ece72a05 status=IN_PROGRESS
[polling+upgrade (default)] PATCH /tasks/:id -> 200
[websocket-only] signup -> 201, token present: true
[websocket-only] POST /tasks -> 201 id=41f1ef4d-e0ea-419d-860d-7d2a0b82a7c1
[websocket-only] connected id=loadEFaf4AhOshSSAAAL transport=websocket (no Origin header sent)
[websocket-only] RECEIVED task.updated eventId=5933084f-9d1c-4c0d-a1d6-232e91ba186f task.id=41f1ef4d-e0ea-419d-860d-7d2a0b82a7c1 status=IN_PROGRESS
[websocket-only] PATCH /tasks/:id -> 200
[negative] bad token -> connect_error: Unauthorized
```

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/mobile/src/realtime.test.ts` (33), `src/rootLayoutRealtime.test.tsx`, `src/storage.test.ts` (listener isolation) — pass |
| Verification command run | ☒ pass | `integ/wave3` `231bd1a`: `Tests: 384 passed, 384 total` ×2, exit 0; typecheck exit 0; iOS export exit 0 — pass |
| Negative cases hold | ☒ pass | bad token rejected (AC5); no reconnect after logout; stale `connect_error` does not kill successor; token never logged (spy) — pass |
| verify | ☒ pass | Real API + real socket.io round-trip (AC5 above) — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `src/{realtime,storage}.ts`, `app/_layout.tsx`, lockfile (`socket.io-client` importer + 2 transitive-peer names only) — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 384/384 — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no UI — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no UI — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no UI — N/A |

## Demonstration

**BEFORE**: Mobile never received `task.updated` / `comment.created` / `announcement.created`; lists refreshed only on navigation.

**AFTER**: A signed-in device holds one kitchen-room socket while foregrounded; events invalidate the matching queries; logout, background and rejected handshakes tear it down.

**DELTA**: T017 realtime reaches mobile, with the token lifecycle bound to the session.

**WITNESS**: Supervisor (main session), 2026-10-29.
