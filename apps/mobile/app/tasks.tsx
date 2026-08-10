
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  confirmTaskCompletion,
  createTask,
  fetchAssignableUsers,
  generateTaskFromGuideline,
  generateTaskFromRecipe,
  listGuidelines,
  listIngredients,
  listRecipes,
  listTasks,
  previewTaskCompletion,
  updateTaskStatus,
  type AssignableUser,
  type CompletionPreview,
  type Guideline,
  type Ingredient,
  type Recipe,
  type Task,
  type TaskStatus,
} from '../src/api';
import { session } from '../src/session';

type CreateMode = 'plain' | 'recipe' | 'guideline';

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

function toIsoFromDateInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

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
  const user = session.getUser();
  const canCreate = !!user && WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('plain');
  const [createTitle, setCreateTitle] = useState('');
  const [createAssigneeId, setCreateAssigneeId] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedGuidelineId, setSelectedGuidelineId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const grouped = useMemo(() => ({
    TODO: tasks.filter((task) => task.status === 'TODO'),
    IN_PROGRESS: tasks.filter((task) => task.status === 'IN_PROGRESS'),
    DONE: tasks.filter((task) => task.status === 'DONE'),
  }), [tasks]);

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

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listTasks()
      .then((items) => {
        if (!cancelled) {
          setTasks(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tasks');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    Promise.all([
      listRecipes(),
      listGuidelines(),
      listIngredients(),
      canCreate ? fetchAssignableUsers() : Promise.resolve([] as AssignableUser[]),
    ])
      .then(([recipeItems, guidelineItems, ingredientItems, assignableItems]) => {
        if (!cancelled) {
          setRecipes(recipeItems);
          setGuidelines(guidelineItems);
          setIngredients(ingredientItems);
          setAssignableUsers(assignableItems);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignableUsers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canCreate, router, user]);

  const openCreate = () => {
    if (!canCreate) return;
    setCreateOpen(true);
    setCreateMode('plain');
    setCreateTitle('');
    setCreateAssigneeId('');
    setCreateDueDate('');
    setSelectedRecipeId('');
    setSelectedGuidelineId('');
    setCreateError(null);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
  };

  const handleCreate = async () => {
    if (!canCreate) return;

    setCreateError(null);

    try {
      setCreating(true);
      let created: Task;

      if (createMode === 'plain') {
        const title = createTitle.trim();
        if (!title) {
          setCreateError('Title is required');
          return;
        }

        const dueAt = toIsoFromDateInput(createDueDate);
        created = await createTask({
          title,
          ...(createAssigneeId ? { assigneeId: createAssigneeId } : {}),
          ...(dueAt ? { dueAt } : {}),
        });
      } else if (createMode === 'recipe') {
        if (!selectedRecipeId) {
          setCreateError('Select a recipe');
          return;
        }
        created = await generateTaskFromRecipe(selectedRecipeId);
      } else {
        if (!selectedGuidelineId) {
          setCreateError('Select a guideline');
          return;
        }
        created = await generateTaskFromGuideline(selectedGuidelineId);
      }

      setTasks((current) => [created, ...current]);
      closeCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

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

        const result = await confirmTaskCompletion(task.id);
        setTasks((current) => current.map((item) => (item.id === task.id ? result.task : item)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete task');
      } finally {
        setSavingId(null);
      }
      return;
    }

    const previous = tasks;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: next } : item)));

    try {
      const updated = await updateTaskStatus(task.id, next);
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch (err) {
      setTasks(previous);
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
      const result = await confirmTaskCompletion(pendingCompletion.taskId);
      setTasks((current) => current.map((item) => (item.id === pendingCompletion.taskId ? result.task : item)));
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

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
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
                    setCreateMode(mode);
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
                <TextInput
                  style={styles.input}
                  placeholder="Task title"
                  placeholderTextColor="#6f7c92"
                  value={createTitle}
                  onChangeText={setCreateTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Due date YYYY-MM-DD"
                  placeholderTextColor="#6f7c92"
                  value={createDueDate}
                  onChangeText={setCreateDueDate}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Assignee ID (optional)"
                  placeholderTextColor="#6f7c92"
                  value={createAssigneeId}
                  onChangeText={setCreateAssigneeId}
                  autoCapitalize="none"
                />
                {assignableUsers.length > 0 && (
                  <View style={styles.selectorList}>
                    {assignableUsers.map((member) => (
                      <Pressable
                        key={member.id}
                        style={[styles.selectorButton, createAssigneeId === member.id && styles.selectorButtonActive]}
                        onPress={() => setCreateAssigneeId(member.id)}
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
                      onPress={() => setSelectedRecipeId(recipe.id)}
                    >
                      <Text style={[styles.selectorButtonText, selectedRecipeId === recipe.id && styles.selectorButtonTextActive]}>
                        {recipe.name}
                      </Text>
                    </Pressable>
                  ))
                )}
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
                      onPress={() => setSelectedGuidelineId(guideline.id)}
                    >
                      <Text style={[styles.selectorButtonText, selectedGuidelineId === guideline.id && styles.selectorButtonTextActive]}>
                        {guideline.title}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {createError && <Text style={styles.error}>{createError}</Text>}

            <View style={styles.rowActions}>
              <Pressable style={styles.secondaryButton} onPress={closeCreate} disabled={creating}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleCreate} disabled={creating}>
                <Text style={styles.primaryButtonText}>{creating ? 'Creating...' : 'Create task'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {loading && <Text style={styles.note}>Loading tasks...</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && tasks.length === 0 && <Text style={styles.note}>No tasks returned.</Text>}

        {(['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).map((status) => (
          <View key={status} style={styles.section}>
            <Text style={styles.sectionTitle}>{STATUS_LABEL[status]}</Text>
            {grouped[status].length === 0 ? (
              <Text style={styles.note}>No tasks in this bucket.</Text>
            ) : (
              grouped[status].map((task) => {
                const next = NEXT_STATUS[task.status];
                const canMove = canEditTask(task) && !!next;
                const sourceTitle = sourceTitleForTask(task);

                return (
                  <View key={task.id} style={styles.taskRow}>
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
              })
            )}
          </View>
        ))}
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 16,
    padding: 24,
    backgroundColor: '#0d1016',
  },
  card: {
    gap: 14,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#171c26',
    borderWidth: 1,
    borderColor: '#273044',
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
    color: '#86a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f4f7ff',
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
    color: '#ff8c8c',
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
  section: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  sectionTitle: {
    color: '#f4f7ff',
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
    color: '#9ca9bf',
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
    color: '#f4f7ff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#6b8cff',
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
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: '#6b8cff',
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
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '800',
  },
  formCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#273044',
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
    backgroundColor: '#0d1016',
  },
  segmentButtonActive: {
    backgroundColor: '#6b8cff',
    borderColor: '#6b8cff',
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
    color: '#f4f7ff',
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
    backgroundColor: '#0d1016',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  selectorButtonActive: {
    backgroundColor: '#1d2740',
    borderColor: '#6b8cff',
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
    backgroundColor: '#171c26',
    borderWidth: 1,
    borderColor: '#273044',
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
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
  },
  deductionAmount: {
    color: '#ccd5e6',
    fontSize: 14,
    fontWeight: '700',
  },
});
