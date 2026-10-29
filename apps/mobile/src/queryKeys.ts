export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    list: () => ['tasks', 'list'] as const,
  },
  recipes: {
    all: ['recipes'] as const,
    list: () => ['recipes', 'list'] as const,
  },
  guidelines: {
    all: ['guidelines'] as const,
    list: () => ['guidelines', 'list'] as const,
  },
  announcements: {
    all: ['announcements'] as const,
    list: () => ['announcements', 'list'] as const,
  },
  notes: {
    all: ['notes'] as const,
    list: (filters: { scope: string; tag?: string }) =>
      ['notes', 'list', { scope: filters.scope, tag: filters.tag ?? null }] as const,
  },
  ingredients: {
    all: ['ingredients'] as const,
    list: () => ['ingredients', 'list'] as const,
    withStock: () => ['ingredients', 'withStock'] as const,
  },
  assignableUsers: {
    all: ['assignableUsers'] as const,
    list: () => ['assignableUsers', 'list'] as const,
  },
  members: {
    all: ['members'] as const,
    list: () => ['members', 'list'] as const,
  },
  invites: {
    all: ['invites'] as const,
    list: () => ['invites', 'list'] as const,
  },
  // M015
  alerts: {
    all: ['alerts'] as const,
    lowStock: () => ['alerts', 'lowStock'] as const,
    expiring: () => ['alerts', 'expiring'] as const,
  },
  // M014
  shiftLogs: {
    all: ['shiftLogs'] as const,
    list: () => ['shiftLogs', 'list'] as const,
  },
};

// M016
export const recipeVersionKeys = {
  all: ['recipeVersions'] as const,
  list: (recipeId: string) => ['recipeVersions', 'list', recipeId] as const,
};
