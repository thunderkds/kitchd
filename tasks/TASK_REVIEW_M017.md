# TASK_REVIEW — M017: Team management + invite entry on login

> Sibling of `tasks/TASK_GUIDE_M017.md`. Filled by the Supervisor, 2026-10-29. Commits `b850535`, integrated on `integ/wave2` (review fixes `7e8e2fc`, `e1846b4`). Reviewer: batched Wave 2 qa-expert (code + security).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Client guards mirror `users.service.ts`: managers = OWNER/ADMIN; targets ≠ self, ≠ OWNER/ADMIN; assignable = CHEF/STAFF/VIEWER — FACT: reviewer verified exact match; mutants 1–5 killed
2. Non-managers no longer fetch `GET /users`; they see web's restricted message (`7e8e2fc`)
3. Controls disabled while a role change or remove is in flight (`e1846b4`) — FACT: two quick taps sent two PATCHes
4. Login "I have an invite" → `/invite/accept` without a session — RULE: T043 lesson (signup creates a new org)
Checks: review — pass; security — PASS; tests 245/245 exit 0; typecheck exit 0
Not done: roster scrolling (M010); device check pending (no simulator)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `src/{teamRules,teamScreen,loginInviteEntry}.test.ts(x)` — pass |
| Verification command run | ☒ pass | Supervisor rerun on `integ/wave2` `e1846b4`: `Tests: 245 passed, 245 total`, test exit 0, typecheck exit 0; iOS `expo export` exit 0 (agent) — pass |
| Negative cases hold | ☒ pass | non-managers see no controls and make no request; cancel on remove confirm makes no call; pending mutation blocks a second — pass |
| verify | ☒ pass | No simulator in this environment: Stage 5 = tests + real typecheck + iOS bundle export; **device check pending (human)** — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `app/{team,index}.tsx`, `src/teamRules.ts`, api/queries tails — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 245/245; web vitest 230/230 (integration run) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | chips + remove on existing rows — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | existing literals — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device/simulator; dashboard + lists scroll fixes are layout-reasoned, device check pending — N/A |

## Demonstration

**BEFORE**: Team screen read-only; a signed-out invitee without the deep link could not reach invite acceptance.

**AFTER**: Owners/Admins change roles and remove members; login has an invite entry.

**DELTA**: User management and invitee onboarding reachable on mobile.

**WITNESS**: Supervisor (main session), 2026-10-29.
