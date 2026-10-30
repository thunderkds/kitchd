# StepGrid

A numbered sequence in one outlined box: pipelines, data flows, scoring steps.

- Markup: `<ol class="gm-strip gm-steps" style="--cols:N">`, each `<li>` holding `.gm-step__no`, `.gm-step__title` and optional `.gm-step__meta` (mono outputs or file names).
- Numbers are two digits and neon (`00` for a phase zero). Use it only when the order is real.
- 5 or 6 cells on desktop; one column below 720px.
