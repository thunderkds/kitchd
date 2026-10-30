# TASK_REVIEW — M021: login landing mid-logout must keep its saved session; trim BEFORE capture

> Sibling of `tasks/TASK_GUIDE_M021.md`. Everything here is **filled by the reviewer at Stage
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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/mobile/src/storage.test.ts` › "a login landing mid-logout (M021)" (2 tests) — pass |
| Verification command run | ☑ pass | post-merge on `feat/m001-pnpm-workspace`: `Tests: 463 passed, 463 total`; typecheck 0 errors |
| Negative cases hold | ☑ pass | version unchanged → M013 behaviour (all logout-durability tests unchanged and green); legacy delete fails + login landed → new session not overwritten |
| verify | ☑ N/A | no simulator; auto-checked by the suite — pass; device check pending (human) |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | `clearSession` + its callers (`src/api.ts:273`, `app/dashboard.tsx:79`) + the only other version writer (`src/theme.ts:84-86`, reads the user fresh, writes nothing once cleared) |
| Full smoke suite still green (no regression) | ☑ pass | 463/463 |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no UI |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ N/A | no UI |
| **UI: Responsiveness at target viewports** | ☑ N/A | no UI |

Code review (Supervisor, inline): 0 P0/P1/P2; P3 — a login landing during the final `session` delete await is not detected, safe because SecureStore serialises operations (delete issued before the login's write). Security review (Supervisor, inline, Risk Medium): no findings — the early return only fires after a newer write, and the only non-login writer cannot write once the session is cleared. Startup reads line present.

---

## Demonstration

> Anchors what this task delivered to an observable before/after pair. BEFORE has no `N/A` path:
> if the task changes executable code, BEFORE is a pasted, timestamped terminal capture taken
> **before any implementation commit exists**; if it does not (docs, templates, skill-instruction
> text), BEFORE is the **verbatim prior content** of what changed — a quoted excerpt, not a command.

**BEFORE**: `date -u` -> Fri Oct 30 04:51:34 AM UTC 2026; `pnpm --filter @kitchenos/mobile test -- storage` (new race test added, `storage.ts` unchanged):
```
FAIL src/storage.test.ts
  ● native session storage: logout durability (M013) › a login landing mid-logout (M021) › AC1: persistSession completing while clearSession awaits its deletes keeps the new session
Tests:       1 failed, 39 passed, 40 total
```

**AFTER**: `Tests: 463 passed, 463 total` (post-merge)

**DELTA**: Signing in immediately after signing out no longer risks losing the new session on the next launch.

**WITNESS**: Supervisor re-ran the suite post-merge, 2026-10-30.
