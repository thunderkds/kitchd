import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  currentStockFromMovements,
  fetchAssignableUsers,
  listAnnouncements,
  listGuidelines,
  listIngredients,
  listMembers,
  listMovements,
  listNotes,
  listPendingInvites,
  listRecipes,
  listTasks,
  removeMember,
  updateMemberRole,
  type Ingredient,
  type NoteScope,
} from './api';
import type { UserRole } from '@kitchenos/shared';
import { queryKeys } from './queryKeys';

export type IngredientRow = Ingredient & {
  currentStock: number | null;
};

// Read hooks for the list screens. `api.ts` stays the fetch layer: each queryFn is one of its
// functions. `enabled` lets a screen hold the request until it knows the caller may make it.

export function useTasks(enabled = true) {
  return useQuery({ queryKey: queryKeys.tasks.list(), queryFn: listTasks, enabled });
}

export function useRecipes(enabled = true) {
  return useQuery({ queryKey: queryKeys.recipes.list(), queryFn: listRecipes, enabled });
}

export function useGuidelines(enabled = true) {
  return useQuery({ queryKey: queryKeys.guidelines.list(), queryFn: listGuidelines, enabled });
}

export function useIngredients(enabled = true) {
  return useQuery({ queryKey: queryKeys.ingredients.list(), queryFn: listIngredients, enabled });
}

export function useAssignableUsers(enabled = true) {
  return useQuery({ queryKey: queryKeys.assignableUsers.list(), queryFn: fetchAssignableUsers, enabled });
}

export function useAnnouncements(enabled = true) {
  return useQuery({ queryKey: queryKeys.announcements.list(), queryFn: listAnnouncements, enabled });
}

export function useNotes(filters: { scope: NoteScope; tag?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notes.list(filters),
    queryFn: () => listNotes({ scope: filters.scope, tag: filters.tag }),
    // Keep the previous filter's notes on screen while the next filter loads, as the screen did before.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMembers(enabled = true) {
  return useQuery({ queryKey: queryKeys.members.list(), queryFn: listMembers, enabled });
}

export function usePendingInvites(enabled = true) {
  return useQuery({ queryKey: queryKeys.invites.list(), queryFn: listPendingInvites, enabled });
}

async function loadIngredientRows(): Promise<IngredientRow[]> {
  const items = await listIngredients();
  return Promise.all(
    items.map(async (ingredient) => {
      try {
        const movements = await listMovements(ingredient.id);
        return { ...ingredient, currentStock: currentStockFromMovements(movements) };
      } catch {
        return { ...ingredient, currentStock: null };
      }
    }),
  );
}

export function useIngredientRows(enabled = true) {
  return useQuery({ queryKey: queryKeys.ingredients.withStock(), queryFn: loadIngredientRows, enabled });
}

// Message for a failed read, matching what the screens' hand-rolled catch blocks showed.
export function queryErrorMessage(error: unknown, fallback: string): string | null {
  if (!error) {
    return null;
  }

  return error instanceof Error ? error.message : fallback;
}

// M017
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateMemberRole(id, role),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
}
