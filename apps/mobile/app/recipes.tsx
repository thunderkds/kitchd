import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createRecipe,
  getRecipe,
  listIngredients,
  listRecipes,
  updateRecipe,
  type Ingredient,
  type Recipe,
  type RecipeInput,
} from '../src/api';
import { session } from '../src/session';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;

type ViewMode = 'list' | 'detail';
type FormMode = 'create' | 'edit';

type RecipeRowInput = {
  ingredientId: string;
  qty: string;
};

const EMPTY_ROW: RecipeRowInput = { ingredientId: '', qty: '' };

function toSteps(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function initialRows(recipe?: Recipe | null): RecipeRowInput[] {
  if (recipe && recipe.ingredients.length > 0) {
    return recipe.ingredients.map((line) => ({ ingredientId: line.ingredientId, qty: String(line.qty) }));
  }

  return [{ ...EMPTY_ROW }];
}

export default function RecipesScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const canWrite = !!caller && WRITE_ROLES.includes(caller.role as (typeof WRITE_ROLES)[number]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formServings, setFormServings] = useState('');
  const [formSteps, setFormSteps] = useState('');
  const [rows, setRows] = useState<RecipeRowInput[]>([{ ...EMPTY_ROW }]);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!caller) {
      router.replace('/');
      return;
    }

    void refresh();
    if (canWrite) {
      listIngredients()
        .then(setIngredients)
        .catch(() => {
          // Non-fatal: the form can still open later with an empty picker state.
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caller, canWrite, router]);

  const refresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const items = await listRecipes();
      setRecipes(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const ingredientById = useMemo(() => new Map(ingredients.map((item) => [item.id, item])), [ingredients]);

  const resetForm = (recipe: Recipe | null = null) => {
    setEditing(recipe);
    setFormName(recipe?.name ?? '');
    setFormServings(recipe?.servings != null ? String(recipe.servings) : '');
    setFormSteps(recipe?.steps.join('\n') ?? '');
    setRows(initialRows(recipe));
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

  const addRow = () => setRows((current) => [...current, { ...EMPTY_ROW }]);
  const removeRow = (idx: number) => setRows((current) => current.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<RecipeRowInput>) =>
    setRows((current) => current.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const setIngredient = (idx: number, ingredientId: string) => {
    updateRow(idx, { ingredientId });
    setActiveRow(null);
  };

  const submitForm = async () => {
    if (!canWrite || saving) return;

    const name = formName.trim();
    const validRows = rows.filter((row) => row.ingredientId && row.qty.trim());
    const parsedServings = formServings.trim() ? Number(formServings) : undefined;

    if (!name) {
      setError('Recipe name is required');
      return;
    }
    if (validRows.length === 0) {
      setError('Add at least one ingredient');
      return;
    }
    if (formServings.trim() && Number.isNaN(parsedServings)) {
      setError('Servings must be a number');
      return;
    }

    const input: RecipeInput = {
      name,
      steps: toSteps(formSteps),
      servings: parsedServings,
      ingredients: validRows.map((row) => ({ ingredientId: row.ingredientId, qty: Number(row.qty) })),
    };

    setSaving(true);
    setError(null);

    try {
      if (formMode === 'edit' && editing) {
        const updated = await updateRecipe(editing.id, input);
        setRecipes((current) => current.map((recipe) => (recipe.id === updated.id ? updated : recipe)));
        setSelected((current) => (current && current.id === updated.id ? updated : current));
      } else {
        const created = await createRecipe(input);
        setRecipes((current) => [created, ...current]);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  if (!caller) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Recipes</Text>
          <Text style={styles.note}>Loading recipes...</Text>
        </View>
      </View>
    );
  }

  if (mode === 'detail' && selected) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
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

          {canWrite && (
            <Pressable style={styles.secondaryButton} onPress={() => openEdit(selected)}>
              <Text style={styles.secondaryButtonText}>Edit recipe</Text>
            </Pressable>
          )}
        </View>

        {formMode && canWrite && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{formMode === 'edit' ? 'Edit recipe' : 'New recipe'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#6f7c92"
              value={formName}
              onChangeText={setFormName}
            />
            <TextInput
              style={styles.input}
              placeholder="Servings"
              placeholderTextColor="#6f7c92"
              keyboardType="decimal-pad"
              value={formServings}
              onChangeText={setFormServings}
            />
            <TextInput
              style={[styles.input, styles.stepsInput]}
              placeholder="Steps, one per line"
              placeholderTextColor="#6f7c92"
              multiline
              value={formSteps}
              onChangeText={setFormSteps}
            />
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {ingredients.length === 0 ? (
              <Text style={styles.note}>No ingredients in inventory yet.</Text>
            ) : (
              rows.map((row, idx) => {
                const selectedIngredient = ingredientById.get(row.ingredientId);
                return (
                  <View key={idx} style={styles.rowCard}>
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
                    <TextInput
                      style={styles.input}
                      placeholder="Quantity"
                      placeholderTextColor="#6f7c92"
                      keyboardType="decimal-pad"
                      value={row.qty}
                      onChangeText={(value) => updateRow(idx, { qty: value })}
                    />
                    <View style={styles.rowActions}>
                      <Pressable style={styles.secondaryButton} onPress={addRow}>
                        <Text style={styles.secondaryButtonText}>Add row</Text>
                      </Pressable>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => removeRow(idx)}
                        disabled={rows.length === 1}
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
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
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
        {recipes.length === 0 ? (
          <Text style={styles.note}>No recipes yet.</Text>
        ) : (
          recipes.map((recipe) => (
            <Pressable key={recipe.id} style={styles.recipeRow} onPress={() => openDetail(recipe)}>
              <Text style={styles.recipeName}>{recipe.name}</Text>
              <Text style={styles.recipeMeta}>
                {recipe.servings != null ? `${recipe.servings} servings · ` : ''}
                Cost {recipe.costComputed.toFixed(2)} · v{recipe.version}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {formMode && canWrite && (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{formMode === 'edit' ? 'Edit recipe' : 'New recipe'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#6f7c92"
            value={formName}
            onChangeText={setFormName}
          />
          <TextInput
            style={styles.input}
            placeholder="Servings"
            placeholderTextColor="#6f7c92"
            keyboardType="decimal-pad"
            value={formServings}
            onChangeText={setFormServings}
          />
          <TextInput
            style={[styles.input, styles.stepsInput]}
            placeholder="Steps, one per line"
            placeholderTextColor="#6f7c92"
            multiline
            value={formSteps}
            onChangeText={setFormSteps}
          />
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {ingredients.length === 0 ? (
            <Text style={styles.note}>No ingredients in inventory yet.</Text>
          ) : (
            rows.map((row, idx) => {
              const selectedIngredient = ingredientById.get(row.ingredientId);
              return (
                <View key={idx} style={styles.rowCard}>
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
                  <TextInput
                    style={styles.input}
                    placeholder="Quantity"
                    placeholderTextColor="#6f7c92"
                    keyboardType="decimal-pad"
                    value={row.qty}
                    onChangeText={(value) => updateRow(idx, { qty: value })}
                  />
                  <View style={styles.rowActions}>
                    <Pressable style={styles.secondaryButton} onPress={addRow}>
                      <Text style={styles.secondaryButtonText}>Add row</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => removeRow(idx)}
                      disabled={rows.length === 1}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
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
  formCard: {
    gap: 12,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#171c26',
    borderWidth: 1,
    borderColor: '#273044',
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
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
  sectionTitle: {
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    color: '#8f9db4',
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: '#9ca9bf',
    fontSize: 12,
  },
  error: {
    color: '#ff8c8c',
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
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  recipeMeta: {
    color: '#9ca9bf',
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
    color: '#86a0ff',
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
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
  },
  ingredientMeta: {
    color: '#9ca9bf',
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
    color: '#f4f7ff',
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
    color: '#f4f7ff',
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
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#6b8cff',
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
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
  },
});
