# TASK_REVIEW — T052: Graphite Mint replaces Dark Neon

> Sibling of `tasks/TASK_GUIDE_T052.md`. Everything here is **filled by the reviewer at Stage
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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/web/src/theme/graphiteMint.test.ts`, `src/theme/onAccentContrast.test.ts`, `src/layout/Sidebar.test.tsx`; updated `SettingsPage.test.tsx`, `LoginPage.test.tsx`, `NotesPage.test.tsx`, `CompleteTaskDialog.test.tsx` — pass |
| Verification command run | ☑ pass | Supervisor re-run on `task/T052`: `Test Files 39 passed (39)` / `Tests 255 passed (255)`; `vite build` ✓; lint warnings only in untouched files — pass |
| Negative cases hold | ☑ pass | Simple token block unchanged apart from on-accent `#ffffff` (test); no `text-white` left in components (test); disabled primary loses glow; toggles don't glow — pass |
| verify | ☑ N/A | Login page captured in both themes by the agent and checked by the Supervisor (computed styles + screenshots) — pass for Login; Dashboard/Tasks/Settings need a signed-in session + API: visual check pending (human) |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | 34 changed files (`b1891dd..task/T052`) + index.css consumers via token classes; API, shared, theme mapping untouched — pass |
| Full smoke suite still green (no regression) | ☑ pass | 255/255 (baseline 233 passing + 21 new/updated failing before) — pass |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ pass | `reports/evidence/T052/login-simple.png` (unchanged purple look) and `login-dark-neon.png` (outlined card, sunken inputs, neon-soft segment, glowing primary with dark text) — pass |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ pass | values diffed against `docs/design/graphite-mint/tokens.json` in `graphiteMint.test.ts`; body font IBM Plex Sans computed in the screenshot run — pass |
| **UI: Responsiveness at target viewports** | ☑ N/A | no layout change |

---

## Demonstration

> Anchors what this task delivered to an observable before/after pair. BEFORE has no `N/A` path:
> if the task changes executable code, BEFORE is a pasted, timestamped terminal capture taken
> **before any implementation commit exists**; if it does not (docs, templates, skill-instruction
> text), BEFORE is the **verbatim prior content** of what changed — a quoted excerpt, not a command.

**BEFORE**: captured 2026-10-30T08:44:17Z (`date -u`), new tests written, no implementation yet (`pnpm --filter @kitchenos/web test`):

```
Test Files  6 failed | 33 passed (39)
     Tests  21 failed | 233 passed (254)
```
Failing new tests: graphiteMint.test.ts (Simple values + on-accent token; dark-neon Graphite values; @theme inline on-accent; bg-surface-raised gradient removed; borderless raised boxes outlined; shadows dropped; sunken inputs; primary-button glow; segmented toggle; sidebar active; sidebar hover; focus ring; IBM Plex body/mono; Google Fonts link), onAccentContrast.test.ts (no text-white on bg-accent; no text-white at all), Sidebar.test.tsx (on-accent text; side-nav hook), SettingsPage.test.tsx (T052 AC8 Graphite Mint label), LoginPage.test.tsx and NotesPage.test.tsx (aria-pressed on toggles).

**AFTER**: Supervisor re-run 2026-10-30 on `task/T052` (f04ca82): `Test Files 39 passed (39)` / `Tests 255 passed (255)`; build clean. OR [verbatim excerpt of the new content]

**DELTA**: A web user who picks the dark theme now gets Graphite Mint: graphite background, outlined cards, readable dark text on mint buttons, the Graphite sidebar highlight, a visible keyboard-focus ring and IBM Plex type — labelled "Graphite Mint"; Simple looks the same.

**WITNESS**: Supervisor re-ran tests/build/lint on `task/T052` and reviewed both screenshots, 2026-10-30; implementing agent captured BEFORE at 08:44:17Z.
