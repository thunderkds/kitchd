# TASK_REVIEW — M019: Comment replies on task detail (web parity) + themed comments section

> Sibling of `tasks/TASK_GUIDE_M019.md`. Everything here is **filled by the reviewer at Stage
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
| **New test(s) cover Acceptance Criteria (file paths pasted)** | ☑ pass | `apps/mobile/src/commentsSection.test.tsx` (6 new: grouping/indent, reply posts `parentId`, cancel reply, VIEWER no Reply, replies no Reply, palette) — pass |
| Verification command run | ☑ pass | post-merge: `Tests: 469 passed, 469 total`; typecheck 0 errors |
| Negative cases hold | ☑ pass | VIEWER sees no Reply; replies have no Reply (API rejects reply-to-reply, `comments.service.ts:95-110`); cancel → top-level post without `parentId` |
| verify | ☑ N/A | no simulator; auto-checked by the suite — pass; device check pending (human) |
| Review scope bounded to the change's blast radius (affected set, not whole repo) | ☑ pass | `src/commentsSection.tsx` + its host `app/task/[taskId].tsx` (unchanged) + its tests |
| Full smoke suite still green (no regression) | ☑ pass | 469/469 |
| **Companion score (easy-verifier)** | ☑ N/A | not run |
| **UI: Visual regression (diff or verdict pasted)** | ☑ N/A | no simulator; palette assertions in tests |
| **UI: Design-system compliance (tokens/colors/typography verified)** | ☑ pass | all colours from `useTheme().palette` (test asserts dark-neon accent/background/border) |
| **UI: Responsiveness at target viewports** | ☑ N/A | single-column list |

Code review (Supervisor, inline): 0 P0/P1/P2. P3 — accepted deviation: the section's off-palette near-duplicates (`#101521` card, `#9aa7c2`, `#ff8a8a`, `#2d374b`, `#222b3a`, `#7f8ba3`) were folded into palette roles, so Simple shifts by imperceptible shades instead of staying byte-identical; consistent with the rest of the app. P3 — a reply whose parent is missing is not shown (same as web). Startup reads line present.

---

## Demonstration

> Anchors what this task delivered to an observable before/after pair. BEFORE has no `N/A` path:
> if the task changes executable code, BEFORE is a pasted, timestamped terminal capture taken
> **before any implementation commit exists**; if it does not (docs, templates, skill-instruction
> text), BEFORE is the **verbatim prior content** of what changed — a quoted excerpt, not a command.

**BEFORE**: captured 2026-10-30 (`date -u`: Fri Oct 30 04:51:34 AM UTC 2026) before any implementation commit, after adding the new tests only:
`pnpm --filter @kitchenos/mobile test src/commentsSection`
```
✕ AC1: groups replies under their parent, indented, after the parent and before the next top-level
✕ AC2: Reply on a top-level comment posts createComment with parentId and the reply appears after refetch
✕ AC2: cancelling the reply returns to a top-level post (no parentId)
✕ AC3: replies have no Reply action
✕ AC4: colours come from the theme palette (simple vs dark-neon accent on the Post button)
(AC2 VIEWER-no-Reply passes vacuously: no Reply exists yet)
Test Suites: 1 failed, 1 total
Tests:       5 failed, 9 passed, 14 total
```

**AFTER**: 2026-10-30 04:53 UTC, verification command: `Test Suites: 48 passed, 48 total` / `Tests: 467 passed, 467 total`; `tsc --noEmit` clean. All 6 new M019 tests in `src/commentsSection.test.tsx` pass.

**DELTA**: [one sentence — what a user can now do that they could not before]

**WITNESS**: Supervisor re-ran the suite post-merge, 2026-10-30.
