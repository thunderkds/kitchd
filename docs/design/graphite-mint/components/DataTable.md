# DataTable

The reference table for hooks, packs, dimensions, kit-by-project and every other list of rows.

- Wrap in `.gm-table-wrap` so wide tables scroll inside the box, never the page.
- Header row: mono 12px `text-muted` on `bg-sunken`, lowercase.
- Identifiers, numbers and paths use `.gm-mono`. Status is a plain word: `.gm-warn-text` for stale or failed, `.gm-nodata` for "no data". No coloured pills.
- Rows highlight on hover with `bg-raised`.
