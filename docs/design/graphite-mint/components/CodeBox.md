# CodeBox

A sunken terminal box for commands, with a neon `$` prompt and one Copy button.

- Markup: `.gm-codebox` > `<code>` (or `.gm-codebox__lines` for several lines) + a small primary Copy button.
- Prompt: `<span class="gm-prompt">$ </span>`; comments: `.gm-comment`, written `# 1  step name`.
- One Copy button per box, copying the whole command block. Long lines scroll inside the box, never the page.
