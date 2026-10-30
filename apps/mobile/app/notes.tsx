import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createNote, deleteNote, updateNote, type Note, type NoteScope } from '../src/api';
import { FormTextInput } from '../src/components/FormFields';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { noteSchema, type NoteFormValues, type NotePayload } from '../src/schemas/note';
import { queryLoadError, useNotes } from '../src/queries';
import { restoreIfSessionUnchanged, sessionTokenAtStart } from '../src/optimisticRollback';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { useTheme, type Palette } from '../src/theme';

const NOTE_SCOPES: NoteScope[] = ['mine', 'team'];

function describeLink(note: Note): string | null {
  if (!note.linkedEntityType || !note.linkedEntityId) {
    return null;
  }

  return `Linked to ${note.linkedEntityType} #${note.linkedEntityId.slice(0, 8)}`;
}

export default function NotesScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const caller = session.getUser();

  const [scope, setScope] = useState<NoteScope>('team');
  const [tagQuery, setTagQuery] = useState('');
  const queryClient = useQueryClient();
  const notesQuery = useNotes({ scope, tag: tagQuery.trim() || undefined }, !!caller);
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  // Also "loading" while the previous filter's notes are shown as placeholder for the new filter.
  const loading = notesQuery.isLoading || notesQuery.isPlaceholderData;
  const [actionError, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<NoteFormValues, undefined, NotePayload>({
    defaultValues: { title: '', body: '', tags: '' },
    resolver: zodResolver(noteSchema),
  });
  const [savingId, setSavingId] = useState<string | null>(null);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes]);

  const error = actionError ?? queryLoadError(notesQuery, 'Failed to load notes');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const createMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes.all }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => updateNote(id, { pinned }),
    onMutate: async ({ id, pinned }) => {
      const tokenAtStart = sessionTokenAtStart();
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.all });
      const previous = queryClient.getQueriesData<Note[]>({ queryKey: queryKeys.notes.all });
      queryClient.setQueriesData<Note[]>({ queryKey: queryKeys.notes.all }, (current) =>
        current?.map((item) => (item.id === id ? { ...item, pinned } : item)),
      );
      return { previous, tokenAtStart };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, data]) =>
        restoreIfSessionUnchanged(queryClient, key, data, context.tokenAtStart),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onMutate: async (id) => {
      const tokenAtStart = sessionTokenAtStart();
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.all });
      const previous = queryClient.getQueriesData<Note[]>({ queryKey: queryKeys.notes.all });
      queryClient.setQueriesData<Note[]>({ queryKey: queryKeys.notes.all }, (current) =>
        current?.filter((item) => item.id !== id),
      );
      return { previous, tokenAtStart };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) =>
        restoreIfSessionUnchanged(queryClient, key, data, context.tokenAtStart),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes.all }),
  });

  const openForm = () => {
    reset();
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    reset();
  };

  const handleCreate = handleSubmit(async (note) => {
    setSavingId('create');
    setError(null);

    try {
      await createMutation.mutateAsync(note);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setSavingId(null);
    }
  });

  const togglePin = async (note: Note) => {
    const nextPinned = !note.pinned;
    setSavingId(note.id);
    setError(null);

    try {
      await pinMutation.mutateAsync({ id: note.id, pinned: nextPinned });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setSavingId(null);
    }
  };

  const removeNote = async (note: Note) => {
    setSavingId(note.id);
    setError(null);

    try {
      await deleteMutation.mutateAsync(note.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setSavingId(null);
    }
  };

  if (!caller) {
    return null;
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Notes</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Notes are authorable by every role. Switch between your notes and the full team feed, filter by tag, and manage pin state.
      </Text>

      <View style={styles.segmentRow}>
        {NOTE_SCOPES.map((candidate) => (
          <Pressable
            key={candidate}
            style={[styles.segmentButton, scope === candidate && styles.segmentButtonActive]}
            onPress={() => setScope(candidate)}
          >
            <Text style={[styles.segmentText, scope === candidate && styles.segmentTextActive]}>
              {candidate === 'mine' ? 'My Notes' : 'Team Notes'}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search by tag"
        placeholderTextColor="#6f7c92"
        value={tagQuery}
        onChangeText={setTagQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable style={styles.primaryButton} onPress={openForm}>
        <Text style={styles.primaryButtonText}>New note</Text>
      </Pressable>

      {formOpen && (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create note</Text>
          <FormTextInput
            control={control}
            name="title"
            style={styles.input}
            placeholder="Title (optional)"
            placeholderTextColor="#6f7c92"
          />
          <FormTextInput
            control={control}
            name="body"
            style={styles.multiLineInput}
            placeholder="Write a note..."
            placeholderTextColor="#6f7c92"
            multiline
          />
          <FormTextInput
            control={control}
            name="tags"
            style={styles.input}
            placeholder="Tags, comma separated"
            placeholderTextColor="#6f7c92"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.formActions}>
            <Pressable style={styles.secondaryButton} onPress={closeForm}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} disabled={savingId === 'create'} onPress={handleCreate}>
              <Text style={styles.primaryButtonText}>{savingId === 'create' ? 'Saving...' : 'Add note'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {loading && <Text style={styles.note}>Loading notes...</Text>}
      {!loading && sortedNotes.length === 0 && <Text style={styles.note}>No notes yet.</Text>}
    </View>
  );

  return (
    <ScreenFrame background={palette.background}>
      <FlashList
        data={sortedNotes}
        keyExtractor={(note) => note.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: note }) => {
          const linked = describeLink(note);
          return (
            <View style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <View style={styles.noteIdentity}>
                  {note.title ? <Text style={styles.noteTitle}>{note.title}</Text> : <Text style={styles.noteTitleMuted}>Untitled note</Text>}
                  <Text style={styles.noteBody}>{note.body}</Text>
                </View>
                <View style={styles.actionColumn}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{note.pinned ? 'Pinned' : 'Note'}</Text>
                  </View>
                  <Pressable style={styles.smallButton} disabled={savingId === note.id} onPress={() => togglePin(note)}>
                    <Text style={styles.smallButtonText}>{savingId === note.id ? '...' : note.pinned ? 'Unpin' : 'Pin'}</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} disabled={savingId === note.id} onPress={() => removeNote(note)}>
                    <Text style={styles.smallButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
              {note.tags.length > 0 && <Text style={styles.tags}>{note.tags.join(' ')}</Text>}
              {linked && <Text style={styles.linked}>{linked}</Text>}
            </View>
          );
        }}
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
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
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
    minHeight: 120,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.text,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
    textAlignVertical: 'top',
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
  noteCard: {
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  noteIdentity: {
    flex: 1,
    gap: 6,
  },
  noteTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  noteTitleMuted: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  noteBody: {
    color: '#ccd5e6',
    fontSize: 14,
    lineHeight: 20,
  },
  tags: {
    color: '#8f9db4',
    fontSize: 12,
    lineHeight: 18,
  },
  linked: {
    color: '#8f9db4',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actionColumn: {
    gap: 8,
    alignItems: 'flex-end',
  },
  badge: {
    alignSelf: 'flex-end',
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
  smallButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  smallButtonText: {
    color: palette.text,
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
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
