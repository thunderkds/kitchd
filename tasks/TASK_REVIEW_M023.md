# TASK_REVIEW — M023: Fold leftover mobile colours into palette roles

> Sibling of `tasks/TASK_GUIDE_M023.md`. Everything here is **filled by the reviewer at Stage
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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/mobile/src/themeRolesM023.test.tsx` (new: role pins, literal scan, Graphite/Simple screen assertions); updated `theme.test.ts`, `alertWidgets.test.tsx`, `themeRolloutB.test.tsx` — pass |
| Verification command run | ☑ pass | Supervisor re-run on `task/M023` (c7bb2e1): `Test Suites: 51 passed, 51 total` / `Tests: 535 passed, 535 total`; typecheck 0 errors — pass |
| Negative cases hold | ☑ pass | no #rrggbb literal outside `src/theme.ts` (scan test); ScreenFrame explicit background still wins (`#123456` sentinel test); components without a provider resolve Simple — pass |
| verify | ☑ N/A | no simulator; Supervisor ran `npx expo export --platform ios` — printed `Exported: /tmp/claude-1000/m023-export-sup` — pass for the bundle; device check pending (human) |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | 22 changed files (`ff90227..task/M023`) incl. shared ScreenFrame/FormFields and their callers' tests — pass |
| Full smoke suite still green (no regression) | ☑ pass | 535/535 — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no simulator; device check pending (human) |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ pass | role pins equal docs/design/graphite-mint/tokens.json values (themeRolesM023.test.tsx) — pass |
| **UI: Responsiveness at target viewports** | ☑ N/A | no layout change |

---

## Demonstration

> Anchors what this task delivered to an observable before/after pair. BEFORE has no `N/A` path:
> if the task changes executable code, BEFORE is a pasted, timestamped terminal capture taken
> **before any implementation commit exists**; if it does not (docs, templates, skill-instruction
> text), BEFORE is the **verbatim prior content** of what changed — a quoted excerpt, not a command.

**BEFORE** (captured `Fri Oct 30 10:22:04 UTC 2026`, tests written, no implementation commit yet; `pnpm --filter @kitchenos/mobile test`):
```
FAIL src/alertWidgets.test.tsx
FAIL src/themeRolesM023.test.tsx
FAIL src/themeRolloutB.test.tsx
FAIL src/theme.test.ts
Tests:       19 failed, 514 passed, 533 total
Test Suites: 4 failed, 47 passed, 51 total
```
Failing new/updated tests (names): `palette roles (M023 AC1)` x2 (simple and dark-neon pins); `no leftover colour literals (M023 AC2) > only the allow-listed literals remain`; `<simple|dark-neon> palette applied to screens (M023 AC3, AC4, AC5)` > announcements inputs/hint/divider, dashboard unread badge + secondary buttons, alert widgets warning/danger, shift log selected panel (both themes), plus form fields error, screen frame default background (dark-neon only: Simple already matches); updated `theme.test.ts` x3 (simple pin, Graphite pin, same roles); `alertWidgets.test.tsx` row colours (fold targets); `themeRolloutB.test.tsx` invite-accept secondary text x2.

**AFTER**: Supervisor re-run 2026-10-30 on `task/M023` (c7bb2e1): `Test Suites: 51 passed, 51 total` / `Tests: 535 passed, 535 total`; typecheck clean; iOS export OK. OR [verbatim excerpt of the new content]

**DELTA**: On Graphite Mint, mobile inputs, borders, dividers, secondary and hint text, warnings and selected panels now use the design system's colours instead of the old blue-greys; Simple looks the same apart from a few merged near-identical shades.

**WITNESS**: Supervisor re-ran tests, typecheck and expo export on `task/M023`, 2026-10-30; implementing agent captured BEFORE at 10:22:04Z.
