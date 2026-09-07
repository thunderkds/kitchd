
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  confirmTaskCompletion,
  fetchAssignableUsers,
  getTask,
  listGuidelines,
  listIngredients,
  listRecipes,
  previewTaskCompletion,
  updateTask,
  updateTaskChecklist,
  updateTaskStatus,
  type AssignableUser,
  type CompletionPreview,
  type Guideline,
  type Ingredient,
  type ChecklistItem,
  type Recipe,
  type Task,
  type TaskStatus,
} from '../../src/api';
import { session } from '../../src/session';

type PendingCompletion = {
  taskId: string;
  preview: CompletionPreview;
};

type EditableChecklistItem = {
  key: string;
  id?: string;
  text: string;
  done: boolean;
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

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'No due date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString();
}

function toIsoFromDateInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toEditableItems(task: Task): EditableChecklistItem[] {
  return task.checklistItems.map((item) => ({
    key: item.id,
    id: item.id,
    text: item.text,
    done: item.done,
  }));
}

function toPayloadItems(items: EditableChecklistItem[]): ChecklistItem[] {
  return items.map((item) => ({
    id: item.id ?? item.key,
    text: item.text,
    done: item.done,
  }));
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editItems, setEditItems] = useState<EditableChecklistItem[]>([]);
  const [nextChecklistKey, setNextChecklistKey] = useState(1);
  const [editError, setEditError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const user = session.getUser();
  const canEditDetails = !!user && WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number]);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    if (!taskId) {
      router.replace('/tasks');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTask(taskId)
      .then((item) => {
        if (!cancelled) {
          setTask(item);
          setEditTitle(item.title);
          setEditAssigneeId(item.assigneeId ?? '');
          setEditDueDate(toDateInputValue(item.dueAt));
          setEditItems(toEditableItems(item));
          setNextChecklistKey(item.checklistItems.length + 1);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load task');
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
      canEditDetails ? fetchAssignableUsers() : Promise.resolve([] as AssignableUser[]),
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
  }, [canEditDetails, router, taskId, user]);

  const checklistCompleteCount = useMemo(() => {
    if (!task) return 0;
    return task.checklistItems.filter((item) => item.done).length;
  }, [task]);

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

  const sourceTitleForTask = (value: Task | null): string | null => {
    if (!value) return null;
    if (value.sourceRecipeId) {
      return recipeNameById[value.sourceRecipeId] ?? null;
    }
    if (value.sourceGuidelineId) {
      return guidelineTitleById[value.sourceGuidelineId] ?? null;
    }
    return null;
  };

  const assigneeLabelForTask = (value: Task | null): string => {
    if (!value || !value.assigneeId) {
      return 'Unassigned';
    }
    return assignableLabelById[value.assigneeId] ?? value.assigneeId.slice(0, 8);
  };

  const canEditTask = Boolean(task && user && ((WRITE_ROLES as readonly string[]).includes(user.role) || (user.role === 'STAFF' && task.assigneeId === user.id)));

  const openEdit = () => {
    if (!task || !canEditTask) return;
    setEditing(true);
    setEditError(null);
    setEditTitle(task.title);
    setEditAssigneeId(task.assigneeId ?? '');
    setEditDueDate(toDateInputValue(task.dueAt));
    setEditItems(toEditableItems(task));
    setNextChecklistKey(task.checklistItems.length + 1);
  };

  const closeEdit = () => {
    setEditing(false);
    setEditError(null);
  };

  const updateChecklistItem = (key: string, patch: Partial<EditableChecklistItem>) => {
    setEditItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const addChecklistItem = () => {
    setEditItems((current) => [...current, { key: `new-${nextChecklistKey}`, text: '', done: false }]);
    setNextChecklistKey((value) => value + 1);
  };

  const removeChecklistItem = (key: string) => {
    setEditItems((current) => current.filter((item) => item.key !== key));
  };

  const toggleChecklistItem = async (item: ChecklistItem) => {
    if (!task || !canEditTask) return;
    setSavingChecklistId(item.id);
    setError(null);

    const nextItems = task.checklistItems.map((candidate) =>
      candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate,
    );
    const previous = task;
    setTask({ ...task, checklistItems: nextItems });

    try {
      const updated = await updateTaskChecklist(task.id, nextItems);
      setTask(updated);
    } catch (err) {
      setTask(previous);
      setError(err instanceof Error ? err.message : 'Failed to update checklist');
    } finally {
      setSavingChecklistId(null);
    }
  };

  const advanceStatus = async () => {
    if (!task || !canEditTask) return;
    const next = NEXT_STATUS[task.status];
    if (!next) return;

    setSavingStatus(true);
    setError(null);

    if (next === 'DONE') {
      try {
        const preview = await previewTaskCompletion(task.id);
        if (preview.requiresConfirmation) {
          setPendingCompletion({ taskId: task.id, preview });
          return;
        }

        const result = await confirmTaskCompletion(task.id);
        setTask(result.task);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete task');
      } finally {
        setSavingStatus(false);
      }
      return;
    }

    const previous = task;
    setTask({ ...task, status: next });

    try {
      const updated = await updateTaskStatus(task.id, next);
      setTask(updated);
    } catch (err) {
      setTask(previous);
      setError(err instanceof Error ? err.message : 'Failed to update task status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!task) return;

    if (canEditDetails && !editTitle.trim()) {
      setEditError('Title is required');
      return;
    }
    if (canEditDetails && editDueDate === '' && task.dueAt) {
      setEditError('Clearing a due date is not supported yet.');
      return;
    }
    if (editItems.some((item) => !item.text.trim())) {
      setEditError('Checklist items cannot be empty.');
      return;
    }

    const payload: {
      title?: string;
      assigneeId?: string | null;
      dueAt?: string;
      checklistItems?: ChecklistItem[];
    } = {};

    if (canEditDetails) {
      const nextTitle = editTitle.trim();
      if (nextTitle !== task.title) {
        payload.title = nextTitle;
      }

      const nextAssigneeId = editAssigneeId === '' ? null : editAssigneeId;
      if (nextAssigneeId !== task.assigneeId) {
        payload.assigneeId = nextAssigneeId;
      }

      const nextDueAt = toIsoFromDateInput(editDueDate);
      if (nextDueAt && nextDueAt !== task.dueAt) {
        payload.dueAt = nextDueAt;
      }
    }

    const nextChecklistItems = toPayloadItems(editItems);
    if (JSON.stringify(nextChecklistItems) !== JSON.stringify(task.checklistItems)) {
      payload.checklistItems = nextChecklistItems;
    }

    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const updated = await updateTask(task.id, payload);
      setTask(updated);
      setEditTitle(updated.title);
      setEditAssigneeId(updated.assigneeId ?? '');
      setEditDueDate(toDateInputValue(updated.dueAt));
      setEditItems(toEditableItems(updated));
      closeEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmCompletion = async () => {
    if (!pendingCompletion) return;
    setConfirmingCompletion(true);
    setError(null);

    try {
      const result = await confirmTaskCompletion(pendingCompletion.taskId);
      setTask(result.task);
      setPendingCompletion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setConfirmingCompletion(false);
      setSavingStatus(false);
    }
  };

  const cancelCompletion = () => {
    setPendingCompletion(null);
    setSavingStatus(false);
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
            <Text style={styles.title}>Task detail</Text>
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        {loading && <Text style={styles.note}>Loading task...</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {task && !editing && (
          <>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.meta}>Status: {STATUS_LABEL[task.status]}</Text>
            <Text style={styles.meta}>Checklist: {checklistCompleteCount}/{task.checklistItems.length}</Text>
            <Text style={styles.meta}>Assignee: {assigneeLabelForTask(task)}</Text>
            <Text style={styles.meta}>Due: {formatDate(task.dueAt)}</Text>
            {sourceTitleForTask(task) && <Text style={styles.meta}>From: {sourceTitleForTask(task)}</Text>}
            <Text style={styles.note}>Checklist changes and status updates now use the shared API path from the native shell.</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Checklist</Text>
              {task.checklistItems.length === 0 ? (
                <Text style={styles.note}>No checklist items on this task.</Text>
              ) : (
                task.checklistItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.checklistRow}
                    disabled={!canEditTask}
                    onPress={() => toggleChecklistItem(item)}
                  >
                    <View style={[styles.checkbox, item.done && styles.checkboxChecked]}>
                      <Text style={styles.checkboxText}>{item.done ? '✓' : ''}</Text>
                    </View>
                    <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>{item.text}</Text>
                    {canEditTask && (
                      <Text style={styles.checklistAction}>{savingChecklistId === item.id ? 'Saving...' : item.done ? 'Undo' : 'Done'}</Text>
                    )}
                  </Pressable>
                ))
              )}
            </View>

            {canEditTask && (
              <View style={styles.rowActions}>
                <Pressable style={styles.secondaryButton} onPress={openEdit}>
                  <Text style={styles.secondaryButtonText}>Edit task</Text>
                </Pressable>
                {NEXT_STATUS[task.status] ? (
                  <Pressable style={styles.primaryButton} disabled={savingStatus} onPress={advanceStatus}>
                    <Text style={styles.primaryButtonText}>{savingStatus ? 'Saving...' : `Move to ${STATUS_LABEL[NEXT_STATUS[task.status] as TaskStatus]}`}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.note}>This task is already done.</Text>
                )}
              </View>
            )}
          </>
        )}

        {task && editing && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Edit task</Text>
            {editError && <Text style={styles.error}>{editError}</Text>}

            {canEditDetails && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Task title"
                  placeholderTextColor="#6f7c92"
                  value={editTitle}
                  onChangeText={setEditTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Assignee ID"
                  placeholderTextColor="#6f7c92"
                  value={editAssigneeId}
                  onChangeText={setEditAssigneeId}
                  autoCapitalize="none"
                />
                {assignableUsers.length > 0 && (
                  <View style={styles.selectorList}>
                    {assignableUsers.map((member) => (
                      <Pressable
                        key={member.id}
                        style={[styles.selectorButton, editAssigneeId === member.id && styles.selectorButtonActive]}
                        onPress={() => setEditAssigneeId(member.id)}
                      >
                        <Text style={[styles.selectorButtonText, editAssigneeId === member.id && styles.selectorButtonTextActive]}>
                          {member.email}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Due date YYYY-MM-DD"
                  placeholderTextColor="#6f7c92"
                  value={editDueDate}
                  onChangeText={setEditDueDate}
                  autoCapitalize="none"
                />
              </>
            )}

            <Text style={styles.sectionTitle}>Checklist</Text>
            {editItems.length === 0 && <Text style={styles.note}>No checklist items yet.</Text>}
            {editItems.map((item, index) => (
              <View key={item.key} style={styles.editChecklistRow}>
                <Pressable style={[styles.checkbox, item.done && styles.checkboxChecked]} onPress={() => updateChecklistItem(item.key, { done: !item.done })}>
                  <Text style={styles.checkboxText}>{item.done ? '✓' : ''}</Text>
                </Pressable>
                <TextInput
                  style={styles.editChecklistInput}
                  placeholder={`Checklist item ${index + 1}`}
                  placeholderTextColor="#6f7c92"
                  value={item.text}
                  onChangeText={(value) => updateChecklistItem(item.key, { text: value })}
                />
                <Pressable style={styles.smallButton} onPress={() => removeChecklistItem(item.key)}>
                  <Text style={styles.smallButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.secondaryButton} onPress={addChecklistItem}>
              <Text style={styles.secondaryButtonText}>Add checklist item</Text>
            </Pressable>

            <View style={styles.rowActions}>
              <Pressable style={styles.secondaryButton} onPress={closeEdit} disabled={savingEdit}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleSaveEdit} disabled={savingEdit}>
                <Text style={styles.primaryButtonText}>{savingEdit ? 'Saving...' : 'Save changes'}</Text>
              </Pressable>
            </View>
          </View>
        )}
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
  taskTitle: {
    color: '#f4f7ff',
    fontSize: 22,
    fontWeight: '800',
  },
  meta: {
    color: '#9ca9bf',
    fontSize: 14,
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
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2d374b',
    backgroundColor: '#101521',
  },
  checkboxChecked: {
    backgroundColor: '#6b8cff',
    borderColor: '#6b8cff',
  },
  checkboxText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  checklistText: {
    flex: 1,
    color: '#ccd5e6',
    fontSize: 14,
  },
  checklistTextDone: {
    color: '#8f9db4',
    textDecorationLine: 'line-through',
  },
  checklistAction: {
    color: '#9ca9bf',
    fontSize: 12,
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
  rowActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  formCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#273044',
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
  editChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editChecklistInput: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f4f7ff',
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  smallButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  smallButtonText: {
    color: '#f4f7ff',
    fontSize: 12,
    fontWeight: '700',
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
