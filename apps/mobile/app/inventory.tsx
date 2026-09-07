import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createIngredient,
  currentStockFromMovements,
  listIngredients,
  listMovements,
  receiveStock,
  updateIngredient,
  type Ingredient,
} from '../src/api';
import { session } from '../src/session';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;

type IngredientRow = Ingredient & {
  currentStock: number | null;
};

type IngredientFormState = {
  name: string;
  unit: string;
  costPerUnit: string;
  category: string;
  minThreshold: string;
};

const EMPTY_FORM: IngredientFormState = {
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

  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientRow | null>(null);
  const [form, setForm] = useState<IngredientFormState>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [savingReceiveId, setSavingReceiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!caller) {
      router.replace('/');
      return;
    }

    void loadIngredients();
  }, [caller, router]);

  const loadIngredients = async () => {
    setLoading(true);
    setError(null);

    try {
      const items = await listIngredients();
      const rows = await Promise.all(
        items.map(async (ingredient) => {
          try {
            const movements = await listMovements(ingredient.id);
            return { ...ingredient, currentStock: currentStockFromMovements(movements) };
          } catch {
            return { ...ingredient, currentStock: null };
          }
        }),
      );
      setIngredients(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (ingredient: IngredientRow) => {
    if (!canManage) return;
    setEditing(ingredient);
    setForm({
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
    setForm(EMPTY_FORM);
  };

  const submitForm = async () => {
    if (!canManage) return;

    const name = form.name.trim();
    const unit = form.unit.trim();
    const costPerUnit = Number(form.costPerUnit);
    const category = form.category.trim();
    const minThreshold = form.minThreshold.trim();

    if (!name || !unit || Number.isNaN(costPerUnit)) {
      setError('Name, unit, and cost are required');
      return;
    }

    setSavingForm(true);
    setError(null);

    const payload = {
      name,
      unit,
      costPerUnit,
      ...(category ? { category } : {}),
      ...(minThreshold ? { minThreshold: Number(minThreshold) } : {}),
    };

    try {
      if (editing) {
        await updateIngredient(editing.id, payload);
      } else {
        await createIngredient(payload);
      }
      closeForm();
      await loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ingredient');
    } finally {
      setSavingForm(false);
    }
  };

  const startReceive = (id: string) => {
    setReceivingId(id);
    setReceiveQty('');
  };

  const cancelReceive = () => {
    setReceivingId(null);
    setReceiveQty('');
  };

  const submitReceive = async (ingredient: IngredientRow) => {
    const qty = Number(receiveQty);
    if (!qty || qty <= 0) {
      setError('Enter a quantity greater than zero');
      return;
    }

    setSavingReceiveId(ingredient.id);
    setError(null);

    try {
      await receiveStock(ingredient.id, { qty });
      setReceivingId(null);
      setReceiveQty('');
      await loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record stock receipt');
    } finally {
      setSavingReceiveId(null);
    }
  };

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
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#6f7c92"
              value={form.name}
              onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Unit"
              placeholderTextColor="#6f7c92"
              value={form.unit}
              onChangeText={(value) => setForm((current) => ({ ...current, unit: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Cost per unit"
              placeholderTextColor="#6f7c92"
              value={form.costPerUnit}
              keyboardType="decimal-pad"
              onChangeText={(value) => setForm((current) => ({ ...current, costPerUnit: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#6f7c92"
              value={form.category}
              onChangeText={(value) => setForm((current) => ({ ...current, category: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Low-stock threshold"
              placeholderTextColor="#6f7c92"
              value={form.minThreshold}
              keyboardType="decimal-pad"
              onChangeText={(value) => setForm((current) => ({ ...current, minThreshold: value }))}
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
                  <TextInput
                    style={styles.input}
                    placeholder="Receive qty"
                    placeholderTextColor="#6f7c92"
                    value={receiveQty}
                    keyboardType="decimal-pad"
                    onChangeText={setReceiveQty}
                  />
                  <View style={styles.rowActions}>
                    <Pressable
                      style={styles.primaryButton}
                      disabled={savingReceiveId === ingredient.id}
                      onPress={() => submitReceive(ingredient)}
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
