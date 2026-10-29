# TASK_REVIEW — M005: Forms + validation (React Hook Form + Zod) on mobile

> Sibling of `tasks/TASK_GUIDE_M005.md`. Filled by the Supervisor, 2026-10-29. Commits `c974be4` (task/M005), merged into `integ/wave3` (`d945ea3`, deps union + lockfile regen), review fixes `dfa7afa`. Reviewer: independent qa-expert (mutations run in a `git archive` copy).

## Decisions (normal mode — user granted merge/push authority; not `[auto]`)

1. Schemas follow the API DTO where web is looser (recipe servings int > 0, row qty > 0, cost > 0) — RULE: guide AC4 "never send a request the API would reject"
2. Login password has no min-8 — FACT: `LoginDto @MinLength(1)`; old accounts must still sign in (mutant killed)
3. Email rule is permissive (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), not `z.email()` — FACT: reviewer showed `z.email()` rejects `josé@example.com` / IDN domains that `@IsEmail` accepts, locking such users out of login (P2, fixed `dfa7afa`)
4. zod 4.6.7 + @hookform/resolvers 6.0.2 — FACT: resolvers peer range `zod ^3.25 || ^4`; iOS dev bundle 2.7→3.6 MB accepted (zod locales; minified Hermes build is smaller)
5. Jest `testTimeout: 15000` — FACT: reviewer traced the earlier "1 failing then 5 passes" run to cold-cache timeouts on the first test of heavy screen suites
6. Lane check `EXCEEDS (28 files, 2174 lines)` — FACT: the guide predicted no files; scope matched the in-scope screen list, so this is a labelling gap, not scope creep ⚠ flagged
Checks: review — pass (0 P0/P1; P2 + 2 P3 fixed); 20/21 mutants killed (survivor is equivalent: `Number('')` = 0 is rejected by `> 0`)
Not done: settings rename + shift-log body keep their hand-written guards (already zero-call); confirm-password and threshold pre-fill 5 (new fields, out of scope); guideline detail→Edit shows no form until Back (pre-existing → M013)

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☒ pass | `apps/mobile/src/schemas/{auth,invite,task,ingredient,recipe,communications}.test.ts`, `src/forms.test.tsx`, `src/recipeGuidelineEdit.test.tsx` — pass |
| Verification command run | ☒ pass | `integ/wave3` `dfa7afa`: 44 suites / 406 tests ×2, exit 0; typecheck exit 0; iOS export exit 0 — pass |
| Negative cases hold | ☒ pass | every form: invalid submit → field error + zero API calls; `handleSubmit` bypass mutant killed on all 9 screens — pass |
| verify | ☒ pass | No simulator: tests + typecheck + bundle export; device check pending — pass |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☒ pass | 9 form screens, `src/schemas/*`, `FormFields.tsx`, `api.ts` type-only; M004 rollbacks and M015 invalidations confirmed untouched — pass |
| Full smoke suite still green (no regression) | ☒ pass | mobile 406/406 — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run — N/A |
| **UI: Visual regression (diff or verdict pasted)** | ☒ pass | string diff `c974be4^..c974be4`: only validation texts changed (banner → per-field); labels/placeholders/buttons identical — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no palette change — N/A |
| **UI: Responsiveness at target viewports** | ☑ N/A | no device — N/A |

## Demonstration

**BEFORE**: Forms validated ad hoc; blank ingredient cost was sent as 0; a `0` threshold was sent; edit could never clear a threshold; invalid due dates were silently dropped; a blank invite email failed silently.

**AFTER**: 9 forms validate with Zod schemas mirroring the DTOs, show field-level errors, and make zero API calls on invalid input.

**DELTA**: Mobile can no longer send a shape-invalid request from any form.

**WITNESS**: Supervisor (main session), 2026-10-29.
