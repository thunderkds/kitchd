import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  currentStockFromMovements,
  fetchAssignableUsers,
  fetchNotifications,
  getKitchen,
  listAnnouncements,
  listComments,
  listExpiringSoon,
  listGuidelines,
  listIngredients,
  listLowStock,
  listMembers,
  listMovements,
  listNotes,
  listPendingInvites,
  listRecipes,
  listRecipeVersions,
  listShiftLogs,
  listTasks,
  removeMember,
  updateMemberRole,
  type CommentEntityType,
  type Ingredient,
  type NoteScope,
} from './api';
import type { UserRole } from '@kitchenos/shared';
import { commentKeys, kitchenKeys, queryKeys, recipeVersionKeys } from './queryKeys';

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

// Load error for a list screen. Once data is on screen a failed background refetch keeps showing the
// data (react-query retains it) instead of putting an error banner on top of it.
export function queryLoadError(query: { data: unknown; error: unknown }, fallback: string): string | null {
  return query.data === undefined ? queryErrorMessage(query.error, fallback) : null;
}

// M016
export function useRecipeVersions(recipeId: string | null, enabled = true) {
  return useQuery({
    queryKey: recipeVersionKeys.list(recipeId ?? ''),
    queryFn: () => listRecipeVersions(recipeId as string),
    enabled: enabled && !!recipeId,
  });
}

// M015
export function useLowStock(enabled = true) {
  return useQuery({ queryKey: queryKeys.alerts.lowStock(), queryFn: listLowStock, enabled });
}

export function useExpiringSoon(enabled = true) {
  // Arrow wrapper so react-query's context arg is never mistaken for the `days` parameter.
  return useQuery({ queryKey: queryKeys.alerts.expiring(), queryFn: () => listExpiringSoon(), enabled });
}

// M014
export function useShiftLogs(enabled = true) {
  return useQuery({ queryKey: queryKeys.shiftLogs.list(), queryFn: listShiftLogs, enabled });
}

// M008
export function useNotifications(enabled = true) {
  return useQuery({ queryKey: queryKeys.notifications.feed(), queryFn: fetchNotifications, enabled });
}

// M007
export function useComments(entityType: CommentEntityType, entityId: string, enabled = true) {
  return useQuery({
    queryKey: commentKeys.list(entityType, entityId),
    queryFn: () => listComments(entityType, entityId),
    enabled,
  });
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

// M006
export function useKitchen(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: kitchenKeys.detail(id ?? ''),
    queryFn: () => getKitchen(id as string),
    enabled: enabled && !!id,
  });
}
