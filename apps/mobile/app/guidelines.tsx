import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createGuideline,
  getGuideline,
  updateGuideline,
  type Guideline,
  type GuidelineInput,
  type GuidelineType,
} from '../src/api';
import { FormTextInput } from '../src/components/FormFields';
import { guidelineSchema, type GuidelineFormValues, type GuidelinePayload } from '../src/schemas/guideline';
import { queryLoadError, useGuidelines } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { useTheme, type Palette } from '../src/theme';
import { ScreenFrame } from '../src/components/ScreenFrame';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF'] as const;
const GUIDELINE_TYPES: GuidelineType[] = ['SOP', 'CHECKLIST'];

type ViewMode = 'list' | 'detail';
type FormMode = 'create' | 'edit';

export default function GuidelinesScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const caller = session.getUser();
  const canWrite = !!caller && WRITE_ROLES.includes(caller.role as (typeof WRITE_ROLES)[number]);

  const queryClient = useQueryClient();
  const guidelinesQuery = useGuidelines(!!caller);
  const guidelines = useMemo(() => guidelinesQuery.data ?? [], [guidelinesQuery.data]);
  const loading = guidelinesQuery.isLoading;
  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: GuidelineInput }) =>
      id ? updateGuideline(id, payload) : createGuideline(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.guidelines.all }),
  });
  const [selected, setSelected] = useState<Guideline | null>(null);
  const [mode, setMode] = useState<ViewMode>('list');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editing, setEditing] = useState<Guideline | null>(null);
  const [actionError, setError] = useState<string | null>(null);
  const { control, handleSubmit, reset, watch, setValue } = useForm<GuidelineFormValues, undefined, GuidelinePayload>({
    defaultValues: { title: '', type: 'SOP', steps: '' },
    resolver: zodResolver(guidelineSchema),
  });
  const formType = watch('type');
  const [saving, setSaving] = useState(false);

  const selectedSteps = useMemo(() => selected?.steps ?? [], [selected]);

  const error = actionError ?? queryLoadError(guidelinesQuery, 'Failed to load guidelines');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

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
    reset({ title: guideline?.title ?? '', type: guideline?.type ?? 'SOP', steps: guideline?.steps.join('\n') ?? '' });
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
    // The form lives on the list view, so leave the detail view or the button appears to do nothing.
    setMode('list');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditing(null);
  };

  const submitForm = handleSubmit(async (payload) => {
    if (!canWrite || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (formMode === 'edit' && editing) {
        const updated = await saveMutation.mutateAsync({ id: editing.id, payload });
        setSelected((current) => (current && current.id === updated.id ? updated : current));
      } else {
        await saveMutation.mutateAsync({ id: null, payload });
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save guideline');
    } finally {
      setSaving(false);
    }
  });

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
      <ScreenFrame background={palette.background}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.kicker}>KitchenOS mobile</Text>
            <Text style={styles.title}>Guidelines</Text>
            <Text style={styles.note}>Loading guidelines...</Text>
          </View>
        </ScrollView>
      </ScreenFrame>
    );
  }

  if (mode === 'detail' && selected) {
    return (
      <ScreenFrame background={palette.background}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame background={palette.background}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              <FormTextInput
                control={control}
                name="title"
                style={styles.input}
                placeholder="Title"
                placeholderTextColor="#6f7c92"
              />

              <View style={styles.segmentRow}>
                {GUIDELINE_TYPES.map((candidate) => (
                  <Pressable
                    key={candidate}
                    style={[styles.segmentButton, formType === candidate && styles.segmentButtonActive]}
                    onPress={() => setValue('type', candidate)}
                  >
                    <Text style={[styles.segmentText, formType === candidate && styles.segmentTextActive]}>{candidate}</Text>
                  </Pressable>
                ))}
              </View>

              <FormTextInput
                control={control}
                name="steps"
                style={styles.multiLineInput}
                placeholder="Steps, one per line"
                placeholderTextColor="#6f7c92"
                multiline
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
      </ScrollView>
    </ScreenFrame>
  );
}

const createStyles = (palette: Palette) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    gap: 14,
    borderRadius: 24,
    padding: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
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
  meta: {
    color: palette.muted,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: palette.text,
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
    color: palette.accentSoft,
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
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
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
  multiLineInput: {
    minHeight: 128,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.text,
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
  formCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: palette.border,
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
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
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
