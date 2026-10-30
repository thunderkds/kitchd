
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  confirmTaskCompletion,
  createTask,
  generateTaskFromGuideline,
  generateTaskFromRecipe,
  previewTaskCompletion,
  updateTaskStatus,
  type CompletionPreview,
  type Task,
  type TaskStatus,
} from '../src/api';
import {
  queryLoadError,
  useAssignableUsers,
  useGuidelines,
  useIngredients,
  useRecipes,
  useTasks,
} from '../src/queries';
import { restoreIfSessionUnchanged, sessionTokenAtStart } from '../src/optimisticRollback';
import { queryKeys } from '../src/queryKeys';
import { FieldError, FormTextInput } from '../src/components/FormFields';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { createTaskSchema, type CreateTaskFormValues, type CreateTaskRequest } from '../src/schemas/task';
import { session } from '../src/session';
import { useTheme, type Palette } from '../src/theme';

type CreateMode = 'plain' | 'recipe' | 'guideline';

type TaskListRow =
  | { kind: 'section'; id: string; status: TaskStatus }
  | { kind: 'empty'; id: string }
  | { kind: 'task'; id: string; task: Task };

type PendingCompletion = {
  taskId: string;
  preview: CompletionPreview;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
};

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;

const EMPTY_CREATE_FORM: CreateTaskFormValues = {
  mode: 'plain',
  title: '',
  dueDate: '',
  assigneeId: '',
  recipeId: '',
  guidelineId: '',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString();
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function TasksScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const user = session.getUser();
  const canCreate = !!user && WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number]);

  const queryClient = useQueryClient();
  const tasksQuery = useTasks(!!user);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const loading = tasksQuery.isLoading;
  // Lookup data: a failed load just leaves the labels/pickers empty, as before.
  const recipesQuery = useRecipes(!!user);
  const guidelinesQuery = useGuidelines(!!user);
  const ingredientsQuery = useIngredients(!!user);
  const assignableQuery = useAssignableUsers(!!user && canCreate);
  const recipes = useMemo(() => recipesQuery.data ?? [], [recipesQuery.data]);
  const guidelines = useMemo(() => guidelinesQuery.data ?? [], [guidelinesQuery.data]);
  const ingredients = useMemo(() => ingredientsQuery.data ?? [], [ingredientsQuery.data]);
  const assignableUsers = useMemo(() => assignableQuery.data ?? [], [assignableQuery.data]);
  const [actionError, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    watch: watchCreate,
    setValue: setCreateValue,
    clearErrors: clearCreateErrors,
    formState: { errors: createErrors },
  } = useForm<CreateTaskFormValues, undefined, CreateTaskRequest>({
    defaultValues: EMPTY_CREATE_FORM,
    resolver: zodResolver(createTaskSchema),
  });
  const createMode = watchCreate('mode');
  const createAssigneeId = watchCreate('assigneeId');
  const selectedRecipeId = watchCreate('recipeId');
  const selectedGuidelineId = watchCreate('guidelineId');
  const [createError, setCreateError] = useState<string | null>(null);

  const grouped = useMemo(() => ({
    TODO: tasks.filter((task) => task.status === 'TODO'),
    IN_PROGRESS: tasks.filter((task) => task.status === 'IN_PROGRESS'),
    DONE: tasks.filter((task) => task.status === 'DONE'),
  }), [tasks]);

  // One flat list for FlashList: a heading, then that bucket's tasks (or its empty note), per status.
  const rows = useMemo<TaskListRow[]>(
    () =>
      (['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).flatMap((status) => [
        { kind: 'section', id: `section-${status}`, status } as const,
        ...(grouped[status].length === 0
          ? [{ kind: 'empty', id: `empty-${status}` } as const]
          : grouped[status].map((task) => ({ kind: 'task', id: task.id, task }) as const)),
      ]),
    [grouped],
  );

  const ingredientNameById = useMemo(
    () => Object.fromEntries(ingredients.map((ingredient) => [ingredient.id, ingredient.name])),
    [ingredients],
  );

  const recipeNameById = useMemo(
    () => Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe.name])),
    [recipes],
  );

  const guidelineTitleById = useMemo(
    () => Object.fromEntries(guidelines.map((guideline) => [guideline.id, guideline.title])),
    [guidelines],
  );

  const assignableLabelById = useMemo(
    () => Object.fromEntries(assignableUsers.map((member) => [member.id, member.email])),
    [assignableUsers],
  );

  const currentUserId = user?.id ?? null;

  const sourceTitleForTask = (task: Task): string | null => {
    if (task.sourceRecipeId) {
      return recipeNameById[task.sourceRecipeId] ?? null;
    }
    if (task.sourceGuidelineId) {
      return guidelineTitleById[task.sourceGuidelineId] ?? null;
    }
    return null;
  };

  const assigneeLabelForTask = (task: Task): string => {
    if (!task.assigneeId) {
      return 'Unassigned';
    }
    return assignableLabelById[task.assigneeId] ?? task.assigneeId.slice(0, 8);
  };

  const canEditTask = (task: Task): boolean => {
    if (!user) return false;
    if (WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number])) return true;
    return user.role === 'STAFF' && task.assigneeId === currentUserId;
  };

  const error = actionError ?? queryLoadError(tasksQuery, 'Failed to load tasks');

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [router, user]);

  const createMutation = useMutation({
    mutationFn: (request: CreateTaskRequest): Promise<Task> => {
      if (request.mode === 'plain') return createTask(request.input);
      if (request.mode === 'recipe') return generateTaskFromRecipe(request.recipeId);
      return generateTaskFromGuideline(request.guidelineId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => confirmTaskCompletion(taskId),
    // Completion deducts stock, so refresh the ingredient caches and dashboard alerts along with the tasks.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all }),
      ]),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onMutate: async ({ id, status }) => {
      const tokenAtStart = sessionTokenAtStart();
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.list() });
      const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks.list());
      queryClient.setQueryData<Task[]>(queryKeys.tasks.list(), (current) =>
        current?.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      return { previous, tokenAtStart };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        restoreIfSessionUnchanged(queryClient, queryKeys.tasks.list(), context.previous, context.tokenAtStart);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  });

  const openCreate = () => {
    if (!canCreate) return;
    setCreateOpen(true);
    resetCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
  };

  const handleCreate = handleCreateSubmit(async (request) => {
    if (!canCreate) return;

    setCreateError(null);

    try {
      await createMutation.mutateAsync(request);
      closeCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    }
  });

  const moveTask = async (task: Task) => {
    const next = NEXT_STATUS[task.status];
    if (!next || !canEditTask(task)) {
      return;
    }

    setSavingId(task.id);
    setError(null);

    if (next === 'DONE') {
      try {
        const preview = await previewTaskCompletion(task.id);
        if (preview.requiresConfirmation) {
          setPendingCompletion({ taskId: task.id, preview });
          return;
        }

        await completeMutation.mutateAsync(task.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete task');
      } finally {
        setSavingId(null);
      }
      return;
    }

    try {
      await statusMutation.mutateAsync({ id: task.id, status: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSavingId(null);
    }
  };

  const confirmCompletion = async () => {
    if (!pendingCompletion) return;
    setConfirmingCompletion(true);
    setError(null);

    try {
      await completeMutation.mutateAsync(pendingCompletion.taskId);
      setPendingCompletion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setConfirmingCompletion(false);
      setSavingId(null);
    }
  };

  const cancelCompletion = () => {
    setPendingCompletion(null);
    setSavingId(null);
  };

  if (!user) {
    return null;
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Tasks</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Tasks, source generation, checklist updates, and the stock-confirm completion flow now run through the native shell.
      </Text>

      {canCreate && (
        <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Text style={styles.primaryButtonText}>New task</Text>
        </Pressable>
      )}

      {createOpen && canCreate && (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create task</Text>
          <View style={styles.segmentRow}>
            {(['plain', 'recipe', 'guideline'] as CreateMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.segmentButton, createMode === mode && styles.segmentButtonActive]}
                onPress={() => {
                  setCreateValue('mode', mode);
                  clearCreateErrors();
                  setCreateError(null);
                }}
              >
                <Text style={[styles.segmentText, createMode === mode && styles.segmentTextActive]}>
                  {mode === 'plain' ? 'Plain task' : mode === 'recipe' ? 'From recipe' : 'From guideline'}
                </Text>
              </Pressable>
            ))}
          </View>

          {createMode === 'plain' && (
            <>
              <FormTextInput
                control={createControl}
                name="title"
                style={styles.input}
                placeholder="Task title"
                placeholderTextColor="#6f7c92"
              />
              <FormTextInput
                control={createControl}
                name="dueDate"
                style={styles.input}
                placeholder="Due date YYYY-MM-DD"
                placeholderTextColor="#6f7c92"
                autoCapitalize="none"
              />
              <FormTextInput
                control={createControl}
                name="assigneeId"
                style={styles.input}
                placeholder="Assignee ID (optional)"
                placeholderTextColor="#6f7c92"
                autoCapitalize="none"
              />
              {assignableUsers.length > 0 && (
                <View style={styles.selectorList}>
                  {assignableUsers.map((member) => (
                    <Pressable
                      key={member.id}
                      style={[styles.selectorButton, createAssigneeId === member.id && styles.selectorButtonActive]}
                      onPress={() => setCreateValue('assigneeId', member.id)}
                    >
                      <Text style={[styles.selectorButtonText, createAssigneeId === member.id && styles.selectorButtonTextActive]}>
                        {member.email}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          {createMode === 'recipe' && (
            <View style={styles.selectorList}>
              {recipes.length === 0 ? (
                <Text style={styles.note}>No recipes yet.</Text>
              ) : (
                recipes.map((recipe) => (
                  <Pressable
                    key={recipe.id}
                    style={[styles.selectorButton, selectedRecipeId === recipe.id && styles.selectorButtonActive]}
                    onPress={() => setCreateValue('recipeId', recipe.id, { shouldValidate: !!createErrors.recipeId })}
                  >
                    <Text style={[styles.selectorButtonText, selectedRecipeId === recipe.id && styles.selectorButtonTextActive]}>
                      {recipe.name}
                    </Text>
                  </Pressable>
                ))
              )}
              <FieldError message={createErrors.recipeId?.message} />
            </View>
          )}

          {createMode === 'guideline' && (
            <View style={styles.selectorList}>
              {guidelines.length === 0 ? (
                <Text style={styles.note}>No guidelines yet.</Text>
              ) : (
                guidelines.map((guideline) => (
                  <Pressable
                    key={guideline.id}
                    style={[styles.selectorButton, selectedGuidelineId === guideline.id && styles.selectorButtonActive]}
                    onPress={() => setCreateValue('guidelineId', guideline.id, { shouldValidate: !!createErrors.guidelineId })}
                  >
                    <Text style={[styles.selectorButtonText, selectedGuidelineId === guideline.id && styles.selectorButtonTextActive]}>
                      {guideline.title}
                    </Text>
                  </Pressable>
                ))
              )}
              <FieldError message={createErrors.guidelineId?.message} />
            </View>
          )}

          {createError && <Text style={styles.error}>{createError}</Text>}

          <View style={styles.rowActions}>
            <Pressable style={styles.secondaryButton} onPress={closeCreate} disabled={createMutation.isPending}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleCreate} disabled={createMutation.isPending}>
              <Text style={styles.primaryButtonText}>{createMutation.isPending ? 'Creating...' : 'Create task'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading && <Text style={styles.note}>Loading tasks...</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && tasks.length === 0 && <Text style={styles.note}>No tasks returned.</Text>}
    </View>
  );

  return (
    <ScreenFrame background={palette.background}>
      <FlashList
        data={rows}
        keyExtractor={(row) => row.id}
        getItemType={(row) => row.kind}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: row }) => {
          if (row.kind === 'section') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{STATUS_LABEL[row.status]}</Text>
              </View>
            );
          }

          if (row.kind === 'empty') {
            return <Text style={styles.note}>No tasks in this bucket.</Text>;
          }

          const task = row.task;
          const next = NEXT_STATUS[task.status];
          const canMove = canEditTask(task) && !!next;
          const sourceTitle = sourceTitleForTask(task);

          return (
            <View style={styles.taskRow}>
              <Pressable style={styles.taskIdentity} onPress={() => router.push(`/task/${task.id}`)}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>{task.id}</Text>
                <Text style={styles.taskMeta}>{task.checklistItems.length} checklist items</Text>
                <Text style={styles.taskMeta}>Assignee: {assigneeLabelForTask(task)}</Text>
                <Text style={styles.taskMeta}>Due: {formatDate(task.dueAt)}</Text>
                {sourceTitle && (
                  <Text style={styles.taskMeta}>
                    From: {sourceTitle}
                  </Text>
                )}
              </Pressable>
              <View style={styles.taskActions}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{STATUS_LABEL[task.status]}</Text>
                </View>
                {canMove ? (
                  <Pressable
                    style={styles.actionButton}
                    disabled={savingId === task.id}
                    onPress={() => moveTask(task)}
                  >
                    <Text style={styles.actionButtonText}>
                      {savingId === task.id ? 'Saving...' : `Move to ${STATUS_LABEL[next as TaskStatus]}`}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.note}>{task.status === 'DONE' ? 'Completed' : 'Read only'}</Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {pendingCompletion && (
        <View style={styles.overlay}>
          <View style={styles.completionCard}>
            <Text style={styles.sectionTitle}>Confirm stock deduction</Text>
            <Text style={styles.note}>Completing this task will deduct the following ingredients:</Text>
            {pendingCompletion.preview.hasNegativeWarning && (
              <Text style={styles.warning}>
                Warning: at least one ingredient will go below zero on-hand. The deduction will still be applied.
              </Text>
            )}
            <View style={styles.deductionList}>
              {pendingCompletion.preview.deductions.map((deduction) => (
                <View key={deduction.ingredientId} style={styles.deductionRow}>
                  <Text style={styles.deductionName}>{ingredientNameById[deduction.ingredientId] ?? deduction.ingredientId.slice(0, 8)}</Text>
                  <Text style={[styles.deductionAmount, deduction.wouldGoNegative && styles.warningText]}>
                    -{deduction.deductQty} (→ {deduction.resultingStock})
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.rowActions}>
              <Pressable style={styles.secondaryButton} onPress={cancelCompletion} disabled={confirmingCompletion}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={confirmCompletion} disabled={confirmingCompletion}>
                <Text style={styles.primaryButtonText}>{confirmingCompletion ? 'Confirming...' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScreenFrame>
  );
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    content: {
      padding: 24,
    },
    header: {
      gap: 14,
      paddingBottom: 14,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    kicker: {
      color: palette.accentSoft,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    title: {
      color: palette.text,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
    },
    note: {
      color: '#8f9db4',
      fontSize: 13,
      lineHeight: 18,
    },
    error: {
      color: palette.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    warning: {
      color: '#ffd27a',
      fontSize: 13,
      lineHeight: 18,
    },
    warningText: {
      color: '#ffd27a',
      fontWeight: '700',
    },
    sectionHeader: {
      paddingTop: 8,
      paddingBottom: 10,
      borderTopWidth: 1,
      borderTopColor: '#222b3a',
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700',
    },
    taskRow: {
      gap: 10,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: '#222b3a',
    },
    taskIdentity: {
      gap: 2,
    },
    taskTitle: {
      color: '#ccd5e6',
      fontSize: 15,
      fontWeight: '700',
    },
    taskMeta: {
      color: palette.muted,
      fontSize: 12,
    },
    taskActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: '#101521',
      borderWidth: 1,
      borderColor: '#2d374b',
    },
    badgeText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '800',
    },
    actionButton: {
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: palette.accent,
    },
    actionButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
    },
    backButton: {
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: '#101521',
      borderWidth: 1,
      borderColor: '#2d374b',
    },
    backButtonText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
    },
    primaryButton: {
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 14,
      backgroundColor: palette.accent,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
    },
    secondaryButton: {
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: '#2d374b',
      backgroundColor: '#101521',
    },
    secondaryButtonText: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '800',
    },
    formCard: {
      gap: 12,
      padding: 16,
      borderRadius: 20,
      backgroundColor: '#101521',
      borderWidth: 1,
      borderColor: palette.border,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    segmentButton: {
      flexGrow: 1,
      alignItems: 'center',
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: '#2d374b',
      backgroundColor: palette.background,
    },
    segmentButtonActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    segmentText: {
      color: '#c1cbe0',
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: '#ffffff',
    },
    input: {
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: palette.text,
      backgroundColor: '#101521',
      borderWidth: 1,
      borderColor: '#2d374b',
    },
    selectorList: {
      gap: 8,
    },
    selectorButton: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: '#2d374b',
    },
    selectorButtonActive: {
      backgroundColor: '#1d2740',
      borderColor: palette.accent,
    },
    selectorButtonText: {
      color: '#ccd5e6',
      fontSize: 14,
      fontWeight: '700',
    },
    selectorButtonTextActive: {
      color: '#ffffff',
    },
    rowActions: {
      flexDirection: 'row',
      gap: 10,
    },
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      padding: 24,
      backgroundColor: 'rgba(13, 16, 22, 0.85)',
      justifyContent: 'center',
    },
    completionCard: {
      gap: 12,
      borderRadius: 24,
      padding: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    deductionList: {
      gap: 8,
    },
    deductionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: '#222b3a',
    },
    deductionName: {
      flex: 1,
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
    },
    deductionAmount: {
      color: '#ccd5e6',
      fontSize: 14,
      fontWeight: '700',
    },
  });
