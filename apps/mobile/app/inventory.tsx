import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createIngredient,
  receiveStock,
  updateIngredient,
  type ReceiveStockInput,
} from '../src/api';
import { FormTextInput } from '../src/components/FormFields';
import {
  ingredientSchema,
  receiveStockSchema,
  type IngredientFormValues,
  type IngredientPayload,
  type ReceiveStockFormValues,
} from '../src/schemas/ingredient';
import { queryLoadError, useIngredientRows, type IngredientRow } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;

const EMPTY_FORM: IngredientFormValues = {
  name: '',
  unit: '',
  costPerUnit: '',
  category: '',
  minThreshold: '',
};

export default function InventoryScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const canManage = !!caller && WRITE_ROLES.includes(caller.role as (typeof WRITE_ROLES)[number]);

  const queryClient = useQueryClient();
  const ingredientsQuery = useIngredientRows(!!caller);
  const ingredients = useMemo(() => ingredientsQuery.data ?? [], [ingredientsQuery.data]);
  const loading = ingredientsQuery.isLoading;
  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: IngredientPayload }) =>
      id ? updateIngredient(id, payload) : createIngredient(payload),
    // Stock and thresholds drive the dashboard low-stock / expiring widgets too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all }),
      ]),
  });
  const receiveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReceiveStockInput }) => receiveStock(id, input),
    // Stock and thresholds drive the dashboard low-stock / expiring widgets too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.ingredients.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all }),
      ]),
  });
  const [actionError, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientRow | null>(null);
  // Create and edit have different outputs for a blank threshold (key omitted vs explicit null), so the
  // resolver follows whether an ingredient is being edited.
  const {
    control: ingredientControl,
    handleSubmit: handleIngredientSubmit,
    reset: resetIngredientForm,
  } = useForm<IngredientFormValues, undefined, IngredientPayload>({
    defaultValues: EMPTY_FORM,
    resolver: (values, context, options) =>
      (
        zodResolver(ingredientSchema(editing ? 'edit' : 'create')) as unknown as Resolver<
          IngredientFormValues,
          undefined,
          IngredientPayload
        >
      )(values, context, options),
  });
  const [savingForm, setSavingForm] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const {
    control: receiveControl,
    handleSubmit: handleReceiveSubmit,
    reset: resetReceiveForm,
  } = useForm<ReceiveStockFormValues, undefined, ReceiveStockInput>({
    defaultValues: { qty: '' },
    resolver: zodResolver(receiveStockSchema),
  });
  const [savingReceiveId, setSavingReceiveId] = useState<string | null>(null);

  const error = actionError ?? queryLoadError(ingredientsQuery, 'Failed to load ingredients');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    resetIngredientForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (ingredient: IngredientRow) => {
    if (!canManage) return;
    setEditing(ingredient);
    resetIngredientForm({
      name: ingredient.name,
      unit: ingredient.unit,
      costPerUnit: String(ingredient.costPerUnit),
      category: ingredient.category ?? '',
      minThreshold: ingredient.minThreshold != null ? String(ingredient.minThreshold) : '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    resetIngredientForm(EMPTY_FORM);
  };

  const submitForm = handleIngredientSubmit(async (payload) => {
    if (!canManage) return;

    setSavingForm(true);
    setError(null);

    try {
      await saveMutation.mutateAsync({ id: editing ? editing.id : null, payload });
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ingredient');
    } finally {
      setSavingForm(false);
    }
  });

  const startReceive = (id: string) => {
    setReceivingId(id);
    resetReceiveForm({ qty: '' });
  };

  const cancelReceive = () => {
    setReceivingId(null);
    resetReceiveForm({ qty: '' });
  };

  const submitReceive = (ingredient: IngredientRow) =>
    handleReceiveSubmit(async (input) => {
      setSavingReceiveId(ingredient.id);
      setError(null);

      try {
        await receiveMutation.mutateAsync({ id: ingredient.id, input });
        setReceivingId(null);
        resetReceiveForm({ qty: '' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record stock receipt');
      } finally {
        setSavingReceiveId(null);
      }
    });

  if (!caller) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>KitchenOS mobile</Text>
            <Text style={styles.title}>Inventory</Text>
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Browse ingredients, see current stock from the movement ledger, and manage ingredients when your role allows it.
        </Text>

        {canManage && (
          <Pressable style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryButtonText}>Add ingredient</Text>
          </Pressable>
        )}

        {formOpen && canManage && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{editing ? 'Edit ingredient' : 'Add ingredient'}</Text>
            <FormTextInput control={ingredientControl} name="name" style={styles.input} placeholder="Name" placeholderTextColor="#6f7c92" />
            <FormTextInput control={ingredientControl} name="unit" style={styles.input} placeholder="Unit" placeholderTextColor="#6f7c92" />
            <FormTextInput
              control={ingredientControl}
              name="costPerUnit"
              style={styles.input}
              placeholder="Cost per unit"
              placeholderTextColor="#6f7c92"
              keyboardType="decimal-pad"
            />
            <FormTextInput
              control={ingredientControl}
              name="category"
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#6f7c92"
            />
            <FormTextInput
              control={ingredientControl}
              name="minThreshold"
              style={styles.input}
              placeholder="Low-stock threshold"
              placeholderTextColor="#6f7c92"
              keyboardType="decimal-pad"
            />
            <View style={styles.rowActions}>
              <Pressable style={styles.primaryButton} disabled={savingForm} onPress={submitForm}>
                <Text style={styles.primaryButtonText}>{savingForm ? 'Saving...' : 'Save ingredient'}</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={closeForm}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {loading && <Text style={styles.note}>Loading ingredients...</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && ingredients.length === 0 && <Text style={styles.note}>No ingredients yet.</Text>}

        {ingredients.map((ingredient) => (
          <View key={ingredient.id} style={styles.ingredientRow}>
            <View style={styles.ingredientIdentity}>
              <Text style={styles.ingredientName}>{ingredient.name}</Text>
              <Text style={styles.ingredientMeta}>
                Stock: {ingredient.currentStock ?? '—'} {ingredient.unit}
              </Text>
              <Text style={styles.ingredientMeta}>
                Cost: {ingredient.costPerUnit}/{ingredient.unit}
              </Text>
              {ingredient.category ? <Text style={styles.ingredientMeta}>Category: {ingredient.category}</Text> : null}
              {ingredient.minThreshold != null ? <Text style={styles.ingredientMeta}>Min: {ingredient.minThreshold} {ingredient.unit}</Text> : null}
            </View>

            {canManage ? (
              receivingId === ingredient.id ? (
                <View style={styles.receivePanel}>
                  <FormTextInput
                    control={receiveControl}
                    name="qty"
                    style={styles.input}
                    placeholder="Receive qty"
                    placeholderTextColor="#6f7c92"
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.rowActions}>
                    <Pressable
                      style={styles.primaryButton}
                      disabled={savingReceiveId === ingredient.id}
                      onPress={submitReceive(ingredient)}
                    >
                      <Text style={styles.primaryButtonText}>
                        {savingReceiveId === ingredient.id ? 'Saving...' : 'Confirm'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={cancelReceive}>
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.rowActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => openEdit(ingredient)}>
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => startReceive(ingredient.id)}>
                    <Text style={styles.secondaryButtonText}>Receive stock</Text>
                  </Pressable>
                </View>
              )
            ) : null}
          </View>
        ))}
      </View>
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
  sectionTitle: {
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  formCard: {
    gap: 10,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
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
  ingredientRow: {
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  ingredientIdentity: {
    gap: 2,
  },
  ingredientName: {
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  ingredientMeta: {
    color: '#9ca9bf',
    fontSize: 12,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  receivePanel: {
    gap: 10,
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
});
