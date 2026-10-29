# TASK_REVIEW — M015: Dashboard low-stock + expiring widgets

> Sibling of `tasks/TASK_GUIDE_M015.md`. Filled by the Supervisor, 2026-10-29. Commits `5a5370d`, integrated on `integ/wave2` (review fixes `7e8e2fc`, `e1846b4`). Reviewer: batched Wave 2 qa-expert.

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. No `days` param — FACT: server default 3 days, web sends none
2. Inventory writes and task completion invalidate `alerts.all` (`7e8e2fc`) — FACT: widgets were otherwise stale until remount/foreground
3. Critical vs warning styling now tested (`e1846b4`) — FACT: the `/2` mutant survived the original tests
Checks: review — pass; 2/3 mutants killed originally, the survivor killed after `e1846b4`; tests 245/245 exit 0; typecheck exit 0
Not done: —; device check pending (no simulator)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `src/{alertWidgets,alertsApi,inventoryScreen}.test.ts(x)` — pass |
| Verification command run | ☒ pass | Supervisor rerun on `integ/wave2` `e1846b4`: `Tests: 245 passed, 245 total`, test exit 0, typecheck exit 0; iOS `expo export` exit 0 (agent) — pass |
| Negative cases hold | ☒ pass | one widget failing leaves the other populated; null expiry/location handled — pass |
| verify | ☒ pass | No simulator in this environment: Stage 5 = tests + real typecheck + iOS bundle export; **device check pending (human)** — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `src/components/AlertWidgets.tsx`, `app/{dashboard,inventory,tasks}.tsx` — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 245/245; web vitest 230/230 (integration run) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | new widgets — N/A |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | existing literals — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device/simulator; dashboard + lists scroll fixes are layout-reasoned, device check pending — N/A |

## Demonstration

**BEFORE**: `/inventory/alerts/*` had no mobile consumer.

**AFTER**: Dashboard shows low-stock and expiring-soon lists; tap opens inventory.

**DELTA**: T007 alerts reachable on mobile.

**WITNESS**: Supervisor (main session), 2026-10-29.
