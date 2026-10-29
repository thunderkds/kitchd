# TASK_REVIEW — M008: Notification centre

> Sibling of `tasks/TASK_GUIDE_M008.md`. Filled by the Supervisor, 2026-10-29. Commits `b1dea8b`, integrated on `integ/wave2` (review fixes `7e8e2fc`, `e1846b4`). Reviewer: batched Wave 2 qa-expert.

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Mark-read sends no body — FACT: controller marks all unread for the caller; web sends none
2. No push notifications — RULE: guide out of scope (needs APNs/FCM credentials)
3. Mark-read error cleared on retry or successful refetch (review P2, `e1846b4`)
Checks: review — pass; mutants 19–20 killed; tests 245/245 exit 0; typecheck exit 0
Not done: push notifications; realtime badge (M009 invalidates `['notifications']`); device check pending (no simulator)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `src/notificationsScreen.test.tsx`, `src/dashboardScreen.test.tsx` — pass |
| Verification command run | ☒ pass | Supervisor rerun on `integ/wave2` `e1846b4`: `Tests: 245 passed, 245 total`, test exit 0, typecheck exit 0; iOS `expo export` exit 0 (agent) — pass |
| Negative cases hold | ☒ pass | badge hidden at 0; failed feed leaves dashboard rendering with no badge — pass |
| verify | ☒ pass | No simulator in this environment: Stage 5 = tests + real typecheck + iOS bundle export; **device check pending (human)** — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `app/{notifications,dashboard}.tsx`, api/queries/queryKeys tails — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 245/245; web vitest 230/230 (integration run) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | new screen + one dashboard row — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | existing literals — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device/simulator; dashboard + lists scroll fixes are layout-reasoned, device check pending — N/A |

## Demonstration

**BEFORE**: `GET /notifications`, `POST /notifications/mark-read` had no mobile consumer.

**AFTER**: Dashboard unread badge, notifications screen, mark-all-read.

**DELTA**: T016 notifications reachable on mobile.

**WITNESS**: Supervisor (main session), 2026-10-29.
