# TASK_REVIEW — M004: TanStack Query on mobile

> Sibling of `tasks/TASK_GUIDE_M004.md`. Filled by the Supervisor, 2026-10-29. Commits `872322c`, `c56e9f8` (401 redirect), `7e8e2fc` (review fixes), integrated on `integ/wave2` (review fixes `7e8e2fc`, `e1846b4`). Reviewer: independent qa-expert (code + security).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Provider mounted after `sessionReady`; `queryClient.clear()` in `clearSession` AND `persistSession` — FACT: reviewer verified every login/logout path reaches one of the two (mutants M6/M7 killed)
2. 401 navigates to `/` (`src/onUnauthorized.ts`) — FACT: `clear()` silently cancels the in-flight query, which left mounted screens on "Loading…"; fixed before merge
3. Optimistic rollbacks restore only if the session token is unchanged (`src/optimisticRollback.ts`) — FACT: reviewer reproduced user A's list being written back after `clear()` (P2-1)
4. Query load error shown only when there is no data (`queryLoadError`) — FACT: foreground refetch is new, a failed background refetch must not cover visible data (P3-a)
Checks: review — pass (0 P0/P1; 2 P2 + 1 P3 fixed); security — PASS; 9/10 mutants killed, 10th (rollback) killed after fix; tests 245/245 exit 0; typecheck exit 0
Not done: `app/task/[taskId].tsx` not migrated (out of scope); query keys not user-scoped (P3, `clear()` chokepoints suffice); device check pending (no simulator)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `src/{queryClient,queryClientLogout,queries,query401,inviteAcceptScreen,tasksScreen,notesScreen,invitesScreen,inventoryScreen,onUnauthorized}.test.ts(x)` — pass |
| Verification command run | ☒ pass | Supervisor rerun on `integ/wave2` `e1846b4`: `Tests: 245 passed, 245 total`, test exit 0, typecheck exit 0; iOS `expo export` exit 0 (agent) — pass |
| Negative cases hold | ☒ pass | 401/403/404 never retried; 401 clears cache + redirects; stale 401 does not; rollback skipped after logout (mutation-checked) — pass |
| verify | ☒ pass | No simulator in this environment: Stage 5 = tests + real typecheck + iOS bundle export; **device check pending (human)** — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `src/{api,queryClient,queryKeys,queries,storage}.ts`, `_layout.tsx`, 8 list screens; lockfile adds only — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 245/245; web vitest 230/230 (integration run) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | UI strings byte-identical (reviewer string-literal diff) — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no styling change — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device/simulator; dashboard + lists scroll fixes are layout-reasoned, device check pending — N/A |

## Demonstration

**BEFORE**: Every screen hand-rolled `useEffect` fetches; no foreground refresh; no retry policy; logout left server data in component state.

**AFTER**: 8 screens on `useQuery`/`useMutation`; foreground refetch; 401/403/404 never retried; cache cleared on every session change.

**DELTA**: Mobile server state has one cache with a defined session boundary.

**WITNESS**: Supervisor (main session), 2026-10-29.
