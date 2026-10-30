import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRecipe, getRecipe, updateRecipe, type Recipe, type RecipeInput } from '../src/api';
import { FieldError, FormTextInput } from '../src/components/FormFields';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { recipeSchema, type RecipeFormValues, type RecipeRowValues } from '../src/schemas/recipe';
import { queryErrorMessage, queryLoadError, useIngredients, useRecipes, useRecipeVersions } from '../src/queries';
import { queryKeys, recipeVersionKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { useTheme, type Palette } from '../src/theme';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;

type ViewMode = 'list' | 'detail';
type FormMode = 'create' | 'edit';

const EMPTY_ROW: RecipeRowValues = { ingredientId: '', qty: '' };

function formatVersionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initialRows(recipe?: Recipe | null): RecipeRowValues[] {
  if (recipe && recipe.ingredients.length > 0) {
    return recipe.ingredients.map((line) => ({ ingredientId: line.ingredientId, qty: String(line.qty) }));
  }

  return [{ ...EMPTY_ROW }];
}

export default function RecipesScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const caller = session.getUser();
  const canWrite = !!caller && WRITE_ROLES.includes(caller.role as (typeof WRITE_ROLES)[number]);

  const queryClient = useQueryClient();
  const recipesQuery = useRecipes(!!caller);
  const recipes = useMemo(() => recipesQuery.data ?? [], [recipesQuery.data]);
  const loading = recipesQuery.isLoading;
  // Non-fatal: if the ingredient picker data fails to load the form still opens with an empty picker.
  const ingredientsQuery = useIngredients(!!caller && canWrite);
  const ingredients = useMemo(() => ingredientsQuery.data ?? [], [ingredientsQuery.data]);
  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: RecipeInput }) =>
      id ? updateRecipe(id, input) : createRecipe(input),
    // M016: an edit writes a new RecipeVersion, so the open recipe's version history must refetch.
    onSuccess: (_saved, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all }),
        id ? queryClient.invalidateQueries({ queryKey: recipeVersionKeys.list(id) }) : undefined,
      ]),
  });
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const versionsQuery = useRecipeVersions(selected?.id ?? null, !!caller && mode === 'detail');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [actionError, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors: formErrors },
  } = useForm<RecipeFormValues, undefined, RecipeInput>({
    defaultValues: { name: '', servings: '', steps: '', rows: [{ ...EMPTY_ROW }] },
    resolver: zodResolver(recipeSchema),
  });
  const { fields: rowFields, append: appendRow, remove: removeRow } = useFieldArray({ control, name: 'rows' });
  const rows = watch('rows');
  const rowsKey = JSON.stringify(rows);
  const hasRowsError = !!formErrors.rows;

  // A row-level change can fix or break the "at least one complete row" rule, which no single field
  // revalidates. Once a submit has failed, re-check it on every row edit.
  useEffect(() => {
    if (hasRowsError) void trigger('rows');
  }, [hasRowsError, rowsKey, trigger]);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const error = actionError ?? queryLoadError(recipesQuery, 'Failed to load recipes');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const ingredientById = useMemo(() => new Map(ingredients.map((item) => [item.id, item])), [ingredients]);

  const resetForm = (recipe: Recipe | null = null) => {
    setEditing(recipe);
    reset({
      name: recipe?.name ?? '',
      servings: recipe?.servings != null ? String(recipe.servings) : '',
      steps: recipe?.steps.join('\n') ?? '',
      rows: initialRows(recipe),
    });
    setActiveRow(null);
  };

  const openCreate = () => {
    if (!canWrite) return;
    resetForm(null);
    setFormMode('create');
  };

  const openEdit = (recipe: Recipe) => {
    if (!canWrite) return;
    resetForm(recipe);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditing(null);
    setActiveRow(null);
  };

  const openDetail = async (recipe: Recipe) => {
    setError(null);

    try {
      const full = await getRecipe(recipe.id);
      setSelected(full);
      setMode('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe');
    }
  };

  const backToList = () => {
    setSelected(null);
    setMode('list');
    setError(null);
  };

  const addRow = () => appendRow({ ...EMPTY_ROW });

  const setIngredient = (idx: number, ingredientId: string) => {
    setValue(`rows.${idx}.ingredientId`, ingredientId);
    setActiveRow(null);
  };

  const submitForm = handleSubmit(async (input) => {
    if (!canWrite || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (formMode === 'edit' && editing) {
        const updated = await saveMutation.mutateAsync({ id: editing.id, input });
        setSelected((current) => (current && current.id === updated.id ? updated : current));
      } else {
        await saveMutation.mutateAsync({ id: null, input });
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  });

  const rowErrors = formErrors.rows;
  const recipeForm =
    formMode && canWrite ? (
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>{formMode === 'edit' ? 'Edit recipe' : 'New recipe'}</Text>
        <FormTextInput control={control} name="name" style={styles.input} placeholder="Name" placeholderTextColor="#6f7c92" />
        <FormTextInput
          control={control}
          name="servings"
          style={styles.input}
          placeholder="Servings"
          placeholderTextColor="#6f7c92"
          keyboardType="decimal-pad"
        />
        <FormTextInput
          control={control}
          name="steps"
          style={[styles.input, styles.stepsInput]}
          placeholder="Steps, one per line"
          placeholderTextColor="#6f7c92"
          multiline
        />
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <FieldError message={rowErrors?.message ?? rowErrors?.root?.message} />
        {ingredients.length === 0 ? (
          <Text style={styles.note}>No ingredients in inventory yet.</Text>
        ) : (
          rowFields.map((field, idx) => {
            const selectedIngredient = ingredientById.get(rows[idx]?.ingredientId ?? '');
            return (
              <View key={field.id} style={styles.rowCard}>
                <Text style={styles.rowLabel}>Ingredient {idx + 1}</Text>
                <Pressable style={styles.pickerButton} onPress={() => setActiveRow(activeRow === idx ? null : idx)}>
                  <Text style={styles.pickerButtonText}>
                    {selectedIngredient ? `${selectedIngredient.name} (${selectedIngredient.unit})` : 'Choose ingredient'}
                  </Text>
                </Pressable>
                {activeRow === idx && (
                  <View style={styles.pickerList}>
                    {ingredients.map((ingredient) => (
                      <Pressable
                        key={ingredient.id}
                        style={styles.pickerOption}
                        onPress={() => setIngredient(idx, ingredient.id)}
                      >
                        <Text style={styles.pickerOptionText}>
                          {ingredient.name} ({ingredient.unit})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <FormTextInput
                  control={control}
                  name={`rows.${idx}.qty`}
                  style={styles.input}
                  placeholder="Quantity"
                  placeholderTextColor="#6f7c92"
                  keyboardType="decimal-pad"
                />
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryButton} onPress={addRow}>
                    <Text style={styles.secondaryButtonText}>Add row</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => removeRow(idx)}
                    disabled={rowFields.length === 1}
                  >
                    <Text style={styles.secondaryButtonText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
        <View style={styles.rowActions}>
          <Pressable style={styles.primaryButton} disabled={saving} onPress={submitForm}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save recipe'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={closeForm}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    ) : null;

  if (!caller) {
    return null;
  }

  if (loading) {
    return (
      <ScreenFrame background={palette.background}>
        <View style={[styles.content, styles.header]}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Recipes</Text>
          <Text style={styles.note}>Loading recipes...</Text>
        </View>
      </ScreenFrame>
    );
  }

  if (mode === 'detail' && selected) {
    return (
      <ScreenFrame background={palette.background}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.kicker}>KitchenOS mobile</Text>
                <Text style={styles.title}>{selected.name}</Text>
              </View>
              <Pressable style={styles.backButton} onPress={backToList}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.meta}>
              {selected.servings != null ? `${selected.servings} servings · ` : ''}
              Version {selected.version} · Cost {selected.costComputed.toFixed(2)}
            </Text>

            <Text style={styles.sectionTitle}>Steps</Text>
            {selected.steps.length === 0 ? (
              <Text style={styles.note}>No steps yet.</Text>
            ) : (
              selected.steps.map((step, idx) => (
                <View key={`${selected.id}-step-${idx}`} style={styles.stepRow}>
                  <Text style={styles.stepIndex}>{idx + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>Ingredients</Text>
            {selected.ingredients.length === 0 ? (
              <Text style={styles.note}>No ingredients yet.</Text>
            ) : (
              selected.ingredients.map((line) => (
                <View key={line.ingredientId} style={styles.ingredientLine}>
                  <Text style={styles.ingredientName}>{line.name}</Text>
                  <Text style={styles.ingredientMeta}>
                    {line.qty} {line.unit} · {line.lineCost.toFixed(2)}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.total}>Total cost: {selected.costComputed.toFixed(2)}</Text>

            <Text style={styles.sectionTitle}>Recipe version history</Text>
            {versionsQuery.isLoading && <Text style={styles.note}>Loading version history...</Text>}
            {versionsQuery.isError && (
              <Text style={styles.error}>
                {queryErrorMessage(versionsQuery.error, 'Failed to load recipe versions')}
              </Text>
            )}
            {versionsQuery.data && versionsQuery.data.length === 0 && (
              <Text style={styles.note}>No saved versions yet.</Text>
            )}
            {versionsQuery.data?.map((entry) => (
              <View key={entry.id} style={styles.ingredientLine}>
                <Text style={styles.ingredientName}>
                  Version {entry.version} · {formatVersionDate(entry.createdAt)}
                </Text>
                <Text style={styles.ingredientMeta}>
                  {entry.servings != null ? `${entry.servings} servings · ` : ''}Cost snapshot:{' '}
                  {entry.costComputedAtSnapshot.toFixed(2)}
                </Text>
                <Text style={styles.ingredientMeta}>
                  {entry.steps.length} steps · {entry.ingredientsSnapshot.length} ingredients
                </Text>
              </View>
            ))}

            {canWrite && (
              <Pressable style={styles.secondaryButton} onPress={() => openEdit(selected)}>
                <Text style={styles.secondaryButtonText}>Edit recipe</Text>
              </Pressable>
            )}
          </View>

          {recipeForm}
        </ScrollView>
      </ScreenFrame>
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Recipes</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Browse recipes, open a detail view, and create or edit recipes when your role allows it.
      </Text>

      {canWrite && (
        <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Text style={styles.primaryButtonText}>New recipe</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {recipes.length === 0 && <Text style={styles.note}>No recipes yet.</Text>}

      {recipeForm}
    </View>
  );

  return (
    <ScreenFrame background={palette.background}>
      <FlashList
        data={recipes}
        keyExtractor={(recipe) => recipe.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: recipe }) => (
          <Pressable style={styles.recipeRow} onPress={() => openDetail(recipe)}>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.recipeMeta}>
              {recipe.servings != null ? `${recipe.servings} servings · ` : ''}
              Cost {recipe.costComputed.toFixed(2)} · v{recipe.version}
            </Text>
          </Pressable>
        )}
      />
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
    formCard: {
      gap: 12,
      borderRadius: 24,
      padding: 24,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: 16,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
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
    sectionTitle: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700',
    },
    note: {
      color: '#8f9db4',
      fontSize: 13,
      lineHeight: 18,
    },
    meta: {
      color: palette.muted,
      fontSize: 12,
    },
    error: {
      color: palette.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    total: {
      color: '#cdd7ea',
      fontSize: 14,
      fontWeight: '700',
    },
    recipeRow: {
      gap: 4,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: '#222b3a',
    },
    recipeName: {
      color: palette.text,
      fontSize: 16,
      fontWeight: '700',
    },
    recipeMeta: {
      color: palette.muted,
      fontSize: 12,
    },
    stepRow: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: '#222b3a',
    },
    stepIndex: {
      width: 22,
      color: palette.accentSoft,
      fontSize: 13,
      fontWeight: '700',
    },
    stepText: {
      flex: 1,
      color: '#cdd7ea',
      fontSize: 13,
      lineHeight: 18,
    },
    ingredientLine: {
      gap: 2,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: '#222b3a',
    },
    ingredientName: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
    },
    ingredientMeta: {
      color: palette.muted,
      fontSize: 12,
    },
    rowCard: {
      gap: 10,
      padding: 14,
      borderRadius: 18,
      backgroundColor: '#101521',
      borderWidth: 1,
      borderColor: '#2d374b',
    },
    rowLabel: {
      color: '#cdd7ea',
      fontSize: 13,
      fontWeight: '700',
    },
    rowActions: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
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
    stepsInput: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    pickerButton: {
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: '#2d374b',
      backgroundColor: '#101521',
    },
    pickerButtonText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
    },
    pickerList: {
      gap: 8,
    },
    pickerOption: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: '#161d2b',
      borderWidth: 1,
      borderColor: '#2d374b',
    },
    pickerOptionText: {
      color: '#cdd7ea',
      fontSize: 13,
      fontWeight: '600',
    },
    secondaryButton: {
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: '#2d374b',
      backgroundColor: '#101521',
    },
    secondaryButtonText: {
      color: palette.text,
      fontSize: 14,
      fontWeight: '700',
    },
    primaryButton: {
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: palette.accent,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
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
  });
