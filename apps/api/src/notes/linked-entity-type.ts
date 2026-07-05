// Known entity kinds a Note may polymorphically link to. Validated at
// the DTO layer only — the DB column has no FK constraint (see
// Note.linkedEntityType/linkedEntityId in schema.prisma), matching the
// Task.sourceRecipeId/sourceGuidelineId pattern already used here.
export const LINKED_ENTITY_TYPES = ['recipe', 'task', 'ingredient'] as const;
export type LinkedEntityType = (typeof LINKED_ENTITY_TYPES)[number];
