# TASK_REVIEW — M006: Settings — theme preference + kitchen rename

> Sibling of `tasks/TASK_GUIDE_M006.md`. Filled by the Supervisor, 2026-10-29. Commits `16c516a`, `47961b4`, integrated on `integ/wave2` (review fixes `7e8e2fc`, `e1846b4`). Reviewer: batched Wave 2 qa-expert (code + security).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. `simple` palette = the exact pre-M006 hard-coded colours — FACT: 9 screens are still hard-coded dark; a light `simple` would give a mixed UI. Reviewer byte-compared all 8 literals
2. No `system` theme — FACT: `update-theme.dto.ts` accepts only the Prisma enum `simple | dark_neon`
3. Fixed `dark_neon`→`dark-neon` mapping in `src/session.ts` — FACT: login returned snake_case, so Dark Neon users lost their preference at login
4. Rename shown to CHEF only — FACT: `PATCH /kitchens/:id` is `@Roles(Role.CHEF)` (T048 product question unchanged)
5. Palette rollout to the other 9 screens → M018 backlog ⚠ Dark Neon is visibly partial until then
Checks: review — pass; security — PASS; mutants 10–16 killed; tests 245/245 exit 0; typecheck exit 0
Not done: palette on 9 screens (M018); device check pending (no simulator)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `src/{theme,settingsScreen,settingsApi,dashboardScreen,announcementsTheme,session}.test.ts(x)` — pass |
| Verification command run | ☒ pass | Supervisor rerun on `integ/wave2` `e1846b4`: `Tests: 245 passed, 245 total`, test exit 0, typecheck exit 0; iOS `expo export` exit 0 (agent) — pass |
| Negative cases hold | ☒ pass | failed theme save keeps old value; non-CHEF has no rename control; empty name blocked — pass |
| verify | ☒ pass | No simulator in this environment: Stage 5 = tests + real typecheck + iOS bundle export; **device check pending (human)** — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | `app/{settings,dashboard,announcements}.tsx`, `src/{theme,session,api,queries,queryKeys}.ts` — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 245/245; web vitest 230/230 (integration run) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | `simple` = legacy literals byte-for-byte (reviewer), so default users see no change — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☒ pass | palette tokens on 3 screens; remaining literals listed by reviewer — pass |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device/simulator; dashboard + lists scroll fixes are layout-reasoned, device check pending — N/A |

## Demonstration

**BEFORE**: Mobile ignored the account theme; no way to view or rename the kitchen.

**AFTER**: Settings screen saves the theme to the account and applies it; CHEF can rename the kitchen.

**DELTA**: Theme preference round-trips on mobile; kitchen rename has a mobile surface.

**WITNESS**: Supervisor (main session), 2026-10-29.
