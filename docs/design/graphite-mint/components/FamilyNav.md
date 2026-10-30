# FamilyNav

The header shared by every family site: glyph, product name, mono version tag, then links to the other products.

- Same links in the same order on every site: Easy Kit, Easy Memory, Easy Verifier, then a secondary GitHub button.
- The current site gets `aria-current="page"`: its dot turns neon with a glow and its label `text-strong`.
- Glyphs are 26px outline SVGs in `neon` (Kit: connected nodes, Memory: stacked note bars, Verifier: a check mark), `aria-hidden="true"`.
- The tag (`.gm-tag`) holds the product line and version, e.g. `memory kit · v0.1.0 prototype`.
- Below 720px the links move into the Menu drawer.
