import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createGuideline,
  getGuideline,
  listGuidelines,
  updateGuideline,
  type Guideline,
  type GuidelineType,
} from '../src/api';
import { session } from '../src/session';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;
const GUIDELINE_TYPES: GuidelineType[] = ['SOP', 'CHECKLIST'];

type ViewMode = 'list' | 'detail';
type FormMode = 'create' | 'edit';

function splitSteps(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function GuidelinesScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const canWrite = !!caller && WRITE_ROLES.includes(caller.role as (typeof WRITE_ROLES)[number]);

  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [selected, setSelected] = useState<Guideline | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editing, setEditing] = useState<Guideline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<GuidelineType>('SOP');
  const [formSteps, setFormSteps] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedSteps = useMemo(() => selected?.steps ?? [], [selected]);

  useEffect(() => {
    if (!caller) {
      router.replace('/');
      return;
    }

    void refresh();
  }, [caller, router]);

  const refresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const items = await listGuidelines();
      setGuidelines(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidelines');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (guideline: Guideline) => {
    setError(null);

    try {
      const full = await getGuideline(guideline.id);
      setSelected(full);
      setMode('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guideline');
    }
  };

  const resetForm = (guideline: Guideline | null = null) => {
    setEditing(guideline);
    setFormTitle(guideline?.title ?? '');
    setFormType(guideline?.type ?? 'SOP');
    setFormSteps(guideline?.steps.join('\n') ?? '');
  };

  const openCreate = () => {
    if (!canWrite) return;
    resetForm(null);
    setFormMode('create');
  };

  const openEdit = (guideline: Guideline) => {
    if (!canWrite) return;
    resetForm(guideline);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditing(null);
  };

  const submitForm = async () => {
    if (!canWrite || saving) return;

    const title = formTitle.trim();
    if (!title) {
      setError('Guideline title is required');
      return;
    }

    const payload = {
      title,
      type: formType,
      steps: splitSteps(formSteps),
    };

    setSaving(true);
    setError(null);

    try {
      if (formMode === 'edit' && editing) {
        const updated = await updateGuideline(editing.id, payload);
        setGuidelines((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setSelected((current) => (current && current.id === updated.id ? updated : current));
      } else {
        const created = await createGuideline(payload);
        setGuidelines((current) => [created, ...current]);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save guideline');
    } finally {
      setSaving(false);
    }
  };

  const backToList = () => {
    setSelected(null);
    setMode('list');
    setError(null);
  };

  if (!caller) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Guidelines</Text>
          <Text style={styles.note}>Loading guidelines...</Text>
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
              <Text style={styles.title}>{selected.title}</Text>
            </View>
            <Pressable style={styles.backButton} onPress={backToList}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>

          <Text style={styles.meta}>{selected.type}</Text>
          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.sectionTitle}>Steps</Text>
          {selectedSteps.length === 0 ? (
            <Text style={styles.note}>No steps yet.</Text>
          ) : (
            selectedSteps.map((step, index) => (
              <View key={`${selected.id}-step-${index}`} style={styles.stepRow}>
                <Text style={styles.stepIndex}>{index + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))
          )}

          {canWrite && (
            <Pressable style={styles.primaryButton} onPress={() => openEdit(selected)}>
              <Text style={styles.primaryButtonText}>Edit guideline</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>KitchenOS mobile</Text>
            <Text style={styles.title}>Guidelines</Text>
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Browse operational guidelines. Writers can create or edit SOP/checklist entries directly in the native shell.
        </Text>

        {canWrite && (
          <Pressable style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryButtonText}>New guideline</Text>
          </Pressable>
        )}

        {formMode && (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{formMode === 'edit' ? 'Edit guideline' : 'Create guideline'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#6f7c92"
              value={formTitle}
              onChangeText={setFormTitle}
            />

            <View style={styles.segmentRow}>
              {GUIDELINE_TYPES.map((candidate) => (
                <Pressable
                  key={candidate}
                  style={[styles.segmentButton, formType === candidate && styles.segmentButtonActive]}
                  onPress={() => setFormType(candidate)}
                >
                  <Text style={[styles.segmentText, formType === candidate && styles.segmentTextActive]}>{candidate}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.multiLineInput}
              placeholder="Steps, one per line"
              placeholderTextColor="#6f7c92"
              multiline
              value={formSteps}
              onChangeText={setFormSteps}
            />

            <View style={styles.formActions}>
              <Pressable style={styles.secondaryButton} onPress={closeForm}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} disabled={saving} onPress={submitForm}>
                <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : formMode === 'edit' ? 'Save' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {guidelines.length === 0 ? (
          <Text style={styles.note}>No guidelines yet.</Text>
        ) : (
          guidelines.map((guideline) => (
            <Pressable key={guideline.id} style={styles.listRow} onPress={() => openDetail(guideline)}>
              <View style={styles.listIdentity}>
                <Text style={styles.listTitle}>{guideline.title}</Text>
                <Text style={styles.meta}>{guideline.type}</Text>
              </View>
            </Pressable>
          ))
        )}
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
  meta: {
    color: '#9ca9bf',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  stepIndex: {
    width: 24,
    color: '#86a0ff',
    fontSize: 14,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: '#ccd5e6',
    fontSize: 14,
    lineHeight: 20,
  },
  listRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  listIdentity: {
    gap: 2,
  },
  listTitle: {
    color: '#f4f7ff',
    fontSize: 15,
    fontWeight: '700',
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
  multiLineInput: {
    minHeight: 128,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f4f7ff',
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
    textAlignVertical: 'top',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2d374b',
    backgroundColor: '#101521',
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
  formCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#273044',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
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
  primaryButton: {
    flex: 1,
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
