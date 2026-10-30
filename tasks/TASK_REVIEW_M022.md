# TASK_REVIEW — M022: Graphite Mint replaces Dark Neon

> Sibling of `tasks/TASK_GUIDE_M022.md`. Everything here is **filled by the reviewer at Stage
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

## Decisions (user, not auto mode)

This task was run in normal mode: the user made each choice in the session on 2026-10-30. The session's first request carried `[auto]` (for M013), so `stop_auto_mode_check` treats this task as auto mode too. That is a false positive, and no Advocate debate was run.
1. Graphite Mint replaces Dark Neon; Simple stays; API/DB theme values unchanged. User chose "Replace Dark Neon (Recommended)".
2. Scope = tokens + key components; layouts unchanged. User chose "Tokens + key components (Recommended)".
3. Path B from `BRAINSTORMING_LOG_graphite-mint.md`: mobile fonts cut, web and mobile in parallel. User chose "Go ahead (Recommended)".

## Evidence

| Check | Result | Notes / output snippet |
|-------|--------|------------------------|
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/mobile/src/theme.test.ts`, `themeRolloutA.test.tsx`, `themeRolloutB.test.tsx`, `dashboardScreen.test.tsx`, `announcementsTheme.test.tsx`, `settingsScreen.test.tsx` — pass |
| Verification command run | ☑ pass | Supervisor re-run on `task/M022`: `Test Suites: 50 passed, 50 total` / `Tests: 518 passed, 518 total`; typecheck clean — pass |
| Negative cases hold | ☑ pass | Simple palette identical apart from `onAccent: '#ffffff'` (test); Simple on-accent tests passed before and after (regression guard); white on non-accent fills left as is — pass |
| verify | ☑ N/A | no simulator; agent ran `expo export --platform ios` — succeeded; device check pending (human) — pass for the bundle |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | 22 changed files (`b1891dd..task/M022`); every `styles.primaryButtonText` use on the 3 static-StyleSheet screens checked for the inline override — pass |
| Full smoke suite still green (no regression) | ☑ pass | 518/518 — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no simulator; device check pending (human) |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ pass | `theme.test.ts` asserts the palette equals the tokens.json values — pass |
| **UI: Responsiveness at target viewports** | ☑ N/A | no layout change |

---

## Demonstration

> Anchors what this task delivered to an observable before/after pair. BEFORE has no `N/A` path:
> if the task changes executable code, BEFORE is a pasted, timestamped terminal capture taken
> **before any implementation commit exists**; if it does not (docs, templates, skill-instruction
> text), BEFORE is the **verbatim prior content** of what changed — a quoted excerpt, not a command.

**BEFORE**: captured 2026-10-30T08:42:16Z (`date -u`), tests written, no implementation commit yet.
`pnpm --filter @kitchenos/mobile test` ->
```
Test Suites: 6 failed, 44 passed, 50 total
Tests:       32 failed, 486 passed, 518 total
```
Failing suites: theme.test.ts, themeRolloutA.test.tsx, themeRolloutB.test.tsx, dashboardScreen.test.tsx,
announcementsTheme.test.tsx, settingsScreen.test.tsx. New/updated failing tests include:
- theme.test.ts: "dark-neon holds the Graphite Mint tokens (M022 AC1)", "labels the dark-neon option \"Graphite Mint\" but keeps its id (M022 AC3)", "simple is exactly the look ... (onAccent '#ffffff')", "gives every palette the same colour roles" (onAccent)
- themeRolloutA: "<screen> screen text on the accent fill (M022 AC2) > dark-neon: the primary button label is drawn in onAccent" for guidelines, inventory, notes, recipes, task detail, tasks (6); plus the 6 updated "uses the dark-neon palette" cases
- themeRolloutB: dark-neon cases for team (2), invites, login (2), invite-accept, notifications, shift log (8)
- dashboardScreen: "dark-neon: the Sign out button fills with #3CF5A8 and its text is #0E100F (M022 AC2)" + palette case
- announcementsTheme: dark-neon text on the primary button / palette case
- settingsScreen: "dark-neon: the text on the Save name button is #0E100F (M022 AC2)" + 3 "Graphite Mint" label tests

**AFTER**: Supervisor re-run 2026-10-30 on `task/M022` (20e818d): `Test Suites: 50 passed, 50 total` / `Tests: 518 passed, 518 total`; typecheck clean. OR [verbatim excerpt of the new content]

**DELTA**: A mobile user who picks the dark theme now gets Graphite Mint: graphite background, mint accents and dark, readable text on every mint button, tab and chip — labelled "Graphite Mint"; Simple looks the same.

**WITNESS**: Supervisor re-ran tests and typecheck on `task/M022`, 2026-10-30; implementing agent captured BEFORE at 08:42:16Z.
