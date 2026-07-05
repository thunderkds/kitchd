export const LINKED_ENTITY_TYPES = ['recipe', 'task', 'ingredient'] as const;
export type LinkedEntityType = (typeof LINKED_ENTITY_TYPES)[number];

export interface Note {
  id: string;
  kitchenId: string;
  authorId: string;
  title: string | null;
  body: string;
  tags: string[];
  pinned: boolean;
  linkedEntityType: LinkedEntityType | null;
  linkedEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteScope = 'mine' | 'team';
