# TASK_REVIEW — M007: Comments on task detail

> Sibling of `tasks/TASK_GUIDE_M007.md`. Filled by the Supervisor, 2026-10-29. Commits `0971d69`, integrated on `integ/wave2` (review fixes `7e8e2fc`, `e1846b4`). Reviewer: batched Wave 2 qa-expert.

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Delete rule follows the service (`authorId === caller`, write roles), not web — FACT: web `Comments.tsx` has no delete UI; the guide's premise was wrong
2. Reply composer cut → M018 — SAFER OPTION: not in the ACs; replies from the API still render indented
3. Task detail wrapped in a `ScrollView` — FACT: the screen had none, so a thread would be unreachable; overlay verified to still render (test added in `e1846b4`)
Checks: review — pass; mutants 17–18 killed; tests 245/245 exit 0; typecheck exit 0
Not done: reply composer, mention autocomplete (web has none); device check pending (no simulator)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `src/{commentsSection,commentsApi,taskDetailScreen}.test.ts(x)` — pass |
| Verification command run | ☒ pass | Supervisor rerun on `integ/wave2` `e1846b4`: `Tests: 245 passed, 245 total`, test exit 0, typecheck exit 0; iOS `expo export` exit 0 (agent) — pass |
| Negative cases hold | ☒ pass | empty body blocked; VIEWER has no composer; delete hidden on others' comments — pass |
| verify | ☒ pass | No simulator in this environment: Stage 5 = tests + real typecheck + iOS bundle export; **device check pending (human)** — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `app/task/[taskId].tsx`, `src/commentsSection.tsx`, api/queries/queryKeys tails — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 245/245; web vitest 230/230 (integration run) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | new section, no existing visuals changed except the ScrollView wrap — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | matches existing literals — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device/simulator; dashboard + lists scroll fixes are layout-reasoned, device check pending — N/A |

## Demonstration

**BEFORE**: `GET/POST /comments`, `DELETE /comments/:id` had no mobile consumer.

**AFTER**: Task detail shows the thread, posts (with @mentions resolved server-side) and deletes own comments.

**DELTA**: T015 comments reachable on mobile.

**WITNESS**: Supervisor (main session), 2026-10-29.
