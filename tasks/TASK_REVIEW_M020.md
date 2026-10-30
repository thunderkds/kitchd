# TASK_REVIEW — M020: Theme palette rollout — group B (team, invites, login, invite accept, notifications, shift log, boot) + invite wording

> Sibling of `tasks/TASK_GUIDE_M020.md`. Everything here is **filled by the reviewer at Stage
> 4/5** — it is deliberately NOT in the guide, because the implementing agent re-reads the guide on
> every turn and never fills these two sections.
>
> Consumers resolve each section **guide first, this file second** (`.claude/hooks/lib/guide_sections.py`):
> a legacy guide that still carries these sections inline keeps working unchanged, and a stray
> review file can never override an inline section.

---

<!-- Optional: the final report, only for a task run in auto mode (the user's `[auto]` tag,
`docs/claude-md/tracks.md` `## Auto mode`). To use it, copy the block below out of this comment, to this
place, and replace every <...>. Keep `Mode: auto` as its first line, exactly as written: T182's hook reads
it. Write it to this file before the run ends; the chat message is a copy, not the report. The same
block is the Supervisor's final chat message. It is not the `delivery-report` page and not
Evidence. A taste decision (what the user wants) also ends with the flag. Write `DEBATED` only when ≥2
Advocate `Agent` calls ran for that question, naming each Advocate's option. A decision with no Advocates is
labelled `RULE`, `FACT` or `SAFER OPTION`, never `DEBATED`. A decision flagged `⚠ decided for you` is a choice, and is never labelled `FACT`. A
safety action a rule requires (for example the backup before a delete) is `RULE` without the flag.
At Risk Medium or High, a `RULE:` counts only when it names a written rule (`path:line`,
`path § <heading>`, or `docs/claude-md/tracks.md` `### <section>`), and a `FACT:` needs a Citation
(`path:line "quoted text"`); without one it is a choice and must be `DEBATED`. Good: `2. backed up the CSV
— RULE: `docs/claude-md/tracks.md` `### Stops that stay``. Bad: `1. kept recurring.csv — RULE: Surgical Changes`.

## Auto decisions

Mode: auto
1. <what was decided> — RULE: <the rule>
2. <what was decided> — FACT: <path>:<line> "<quoted text>"
3. <what was decided> — DEBATED: <option> (Advocate 1: <its option>; Advocate 2: <its option>) ⚠ decided for you — please review
4. <what was decided> — SAFER OPTION: <why> ⚠ decided for you — please review
Paused: <only when a stop that stays paused the task: which one, and why>
Checks: tests `<command>` — <result>; reviews <skill — result>; real run `<command>` — printed `<what it printed>` (auto-checked, not /verify)
Not done: merge (yours); <auto verify: running (T182) | auto verify: <result> | /verify (yours)>

-->

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/mobile/src/themeRolloutB.test.tsx` (7 screens incl. boot), `src/inviteAcceptScreen.test.tsx` (notice wording) — pass |
| Verification command run | ☑ pass | after all four wave merges: `Test Suites: 50 passed, 50 total` / `Tests: 499 passed, 499 total`; typecheck 0 errors; `expo export --platform ios` exported |
| Negative cases hold | ☑ pass | Simple cases assert the pre-change hex values (passed before and after) |
| verify | ☑ N/A | no simulator; auto-checked by suite + iOS export — pass; Dark Neon device check pending (human) |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | the 7 screens + `src/rootLayoutRealtime.test.tsx` (one mock line, needed because boot now reads the theme) |
| Full smoke suite still green (no regression) | ☑ pass | 499/499 |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no simulator; palette assertions per screen in tests |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ pass | mapped hexes → `palette.*`; off-palette colours left literal per guide, no tokens added |
| **UI: Responsiveness at target viewports** | ☑ N/A | colour-only change |

Code review (Supervisor, inline): same `createStyles(palette)` deviation as M018, formatted correctly. Out-of-list edit accepted: `rootLayoutRealtime.test.tsx` gains `jest.mock("./session")`. P3: the boot dark-neon test mutates `PALETTES` and restores it in `finally` — works, but a test-only mutation of a shared export. Login/boot are effectively always Simple (no user yet) — by design. Startup reads line present.

---

## Demonstration

> Anchors what this task delivered to an observable before/after pair. BEFORE has no `N/A` path:
> if the task changes executable code, BEFORE is a pasted, timestamped terminal capture taken
> **before any implementation commit exists**; if it does not (docs, templates, skill-instruction
> text), BEFORE is the **verbatim prior content** of what changed — a quoted excerpt, not a command.

**BEFORE**: captured 2026-10-30T04:53:15Z (`date -u`), before any implementation commit, after writing the failing tests (`apps/mobile/src/themeRolloutB.test.tsx` new; `src/inviteAcceptScreen.test.tsx` notice wording updated). Command: `pnpm --filter @kitchenos/mobile test`

```
  ● AcceptInviteScreen signed-in notice (M013 AC7) › tells a signed-in user who they are signed in as and that accepting replaces it
  ● boot screen (M020) › follows the theme store rather than a literal
  ● dark-neon palette (M020 AC1, AC2, AC4) › invite-accept screen: kicker and primary button
  ● dark-neon palette (M020 AC1, AC2, AC4) › invites screen: background, card, kicker and primary button
  ● dark-neon palette (M020 AC1, AC2, AC4) › login form: primary button takes the accent when the theme is injected (no signed-in user)
  ● dark-neon palette (M020 AC1, AC2, AC4) › login screen: kicker and primary button follow the stored theme
  ● dark-neon palette (M020 AC1, AC2, AC4) › notifications screen: kicker and mark-all-read button
  ● dark-neon palette (M020 AC1, AC2, AC4) › shift log screen: kicker and the selected shift
  ● dark-neon palette (M020 AC1, AC2, AC4) › team screen: kicker and the active role chip
  ● dark-neon palette (M020 AC1, AC2, AC4) › team screen (non-manager notice): kicker
Tests:       10 failed, 469 passed, 479 total
Test Suites: 2 failed, 47 passed, 49 total
```
(The `simple` cases already pass: they pin the pre-change colours.)

**AFTER**: 2026-10-30T04:54:29Z, same command `pnpm --filter @kitchenos/mobile test`: `Tests: 479 passed, 479 total`, `Test Suites: 49 passed, 49 total`; `pnpm --filter @kitchenos/mobile typecheck` (`tsc --noEmit`) clean.

**DELTA**: A Dark Neon user sees the neon accent on team, invites, invite accept, notifications and shift log; the invite notice now says it will sign you out of the current account, as on web.

**WITNESS**: Supervisor re-ran the suite after merging the whole wave, 2026-10-30.
