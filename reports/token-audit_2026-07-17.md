# Token Audit Log

This scaffold documents the token-audit convention for the current
window-close condition: close the log after 7 logged sessions or 14 calendar days, whichever comes first. Each row uses a task-tag or the
literal `overhead` marker, includes cache state, records the model-tier,
and tracks `/cost` usage.

## Sample entries
2026-07-17 | cold-start | T001 | hit | haiku | first run after reset
2026-07-17 | stage-0.5 | overhead | miss | sonnet | cache cold, planning only
2026-07-17 | cost | T039 | hit | opus | model-tier review with `/cost` audit

## Real entries
Add production rows here as sessions accumulate.
