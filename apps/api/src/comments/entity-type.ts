// Known entity kinds a Comment may polymorphically attach to. Validated
// at the DTO layer only — the DB column has no FK constraint (see
// Comment.entityType/entityId in schema.prisma), matching the
// Note.linkedEntityType/linkedEntityId pattern already used here.
export const ENTITY_TYPES = ['recipe', 'task', 'ingredient'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
