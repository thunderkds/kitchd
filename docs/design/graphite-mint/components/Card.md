# Card

An outlined box for one item: an experiment, an agent role, an MCP, a warning.

- `.gm-card` is a 1px `line` outline, never a filled panel and never a drop shadow.
- `.gm-card--highlight` adds the neon border and glow. At most one per section (the shipped experiment, the current plan).
- Title `.gm-card__title`, text `.gm-card__text`. Lay cards out in a grid with `space-3` gaps.
- Warning cards keep the plain outline and put an amber triangle icon on a `warn-soft` tile at the left.
