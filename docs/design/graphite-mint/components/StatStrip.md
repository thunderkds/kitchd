# StatStrip

A row of numbers in one outlined box with hairline dividers; the key number is neon.

- Set the column count with `style="--cols:3"` (default 4). Collapses to 2 columns below 720px.
- Number: `.gm-strip__num` in mono 28px; a suffix goes in `<small>` (`5<small>/11</small>`).
- Add `.gm-strip__num--key` to the one number the section is about. Leaving all numbers plain is fine; making all of them neon removes the emphasis.
- Label: `.gm-strip__label`, lowercase, under the number. Missing data reads "no data", never 0.
