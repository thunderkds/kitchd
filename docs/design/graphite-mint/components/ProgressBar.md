# ProgressBar

A 6px bar for ratios: cache hit, coverage, plan limits.

- `.gm-bar` with an inner `<span style="width:N%">`; give it `role="progressbar"` and the aria values.
- Neon fill with a glow below 70%; `.gm-bar--warn` (amber) from 70% to 89%; `.gm-bar--danger` (soft rose) at 90% and above.
- Always print the number and a word next to the bar ("42%", "near limit"): colour alone does not separate neon from amber for everyone.
- Unknown ratio: show "no data", not an empty bar.
