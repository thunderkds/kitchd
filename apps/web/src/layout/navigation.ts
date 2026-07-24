export interface NavItem {
  label: string;
  path: string;
  emptyMessage: string;
}

/** IA per requirement.md §8 — one entry per gated top-level section. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', emptyMessage: 'Your dashboard widgets will appear here once configured.' },
  { label: 'Tasks', path: '/tasks', emptyMessage: 'No tasks yet. Assigned tasks will show up here.' },
  { label: 'Guidelines', path: '/guidelines', emptyMessage: 'No guidelines have been added yet.' },
  { label: 'Recipes', path: '/recipes', emptyMessage: 'No recipes yet.' },
  { label: 'Inventory', path: '/inventory', emptyMessage: 'No stock items tracked yet.' },
  { label: 'Notes', path: '/notes', emptyMessage: 'No notes yet.' },
  { label: 'Announcements', path: '/announcements', emptyMessage: 'No announcements yet.' },
  { label: 'Team & Roles', path: '/team', emptyMessage: 'No team members to show yet.' },
  { label: 'Settings', path: '/settings', emptyMessage: 'Settings will appear here.' },
];
