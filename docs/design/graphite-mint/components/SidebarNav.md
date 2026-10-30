# SidebarNav

Grouped section links for docs pages and the dashboard; the current one is neon with a soft ring.

- Groups: `.gm-sidenav__group`, labelled `// overview` in lowercase mono (`.gm-sidenav__label`).
- Items: `<a class="gm-sidenav__item">`, optional leading `.gm-dot` (the dashboard uses dots, docs pages may omit them).
- Mark the current item with `aria-current="page"` (scroll-spy on docs pages, the active tab in the dashboard). Only one at a time.
- Width 248px on docs, 232px in the dashboard. Below 1024px it moves into a drawer behind a Menu button.
