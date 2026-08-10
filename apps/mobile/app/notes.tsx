import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createNote, deleteNote, listNotes, updateNote, type Note, type NoteScope } from '../src/api';
import { session } from '../src/session';

const NOTE_SCOPES: NoteScope[] = ['mine', 'team'];

function describeLink(note: Note): string | null {
  if (!note.linkedEntityType || !note.linkedEntityId) {
    return null;
  }

  return `Linked to ${note.linkedEntityType} #${note.linkedEntityId.slice(0, 8)}`;
}

export default function NotesScreen() {
  const router = useRouter();
  const caller = session.getUser();

  const [scope, setScope] = useState<NoteScope>('team');
  const [tagQuery, setTagQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newTags, setNewTags] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes]);

  useEffect(() => {
    if (!caller) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listNotes({ scope, tag: tagQuery.trim() || undefined })
      .then((items) => {
        if (!cancelled) {
          setNotes(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load notes');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caller, scope, tagQuery, router]);

  const openForm = () => {
    setNewTitle('');
    setNewBody('');
    setNewTags('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setNewTitle('');
    setNewBody('');
    setNewTags('');
  };

  const refresh = async () => {
    const items = await listNotes({ scope, tag: tagQuery.trim() || undefined });
    setNotes(items);
  };

  const handleCreate = async () => {
    if (!newBody.trim()) {
      setError('Note body is required');
      return;
    }

    const tags = newTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSavingId('create');
    setError(null);

    try {
      const created = await createNote({
        title: newTitle.trim() || undefined,
        body: newBody.trim(),
        tags,
      });
      setNotes((current) => [created, ...current]);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setSavingId(null);
    }
  };

  const togglePin = async (note: Note) => {
    const nextPinned = !note.pinned;
    const previous = notes;
    setSavingId(note.id);
    setError(null);
    setNotes((current) =>
      current
        .map((item) => (item.id === note.id ? { ...item, pinned: nextPinned } : item))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    );

    try {
      const updated = await updateNote(note.id, { pinned: nextPinned });
      setNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setNotes(previous);
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setSavingId(null);
    }
  };

  const removeNote = async (note: Note) => {
    const previous = notes;
    setSavingId(note.id);
    setError(null);
    setNotes((current) => current.filter((item) => item.id !== note.id));

    try {
      await deleteNote(note.id);
    } catch (err) {
      setNotes(previous);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setSavingId(null);
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
            <TextInput
              style={styles.input}
              placeholder="Title (optional)"
              placeholderTextColor="#6f7c92"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.multiLineInput}
              placeholder="Write a note..."
              placeholderTextColor="#6f7c92"
              multiline
              value={newBody}
              onChangeText={setNewBody}
            />
            <TextInput
              style={styles.input}
              placeholder="Tags, comma separated"
              placeholderTextColor="#6f7c92"
              value={newTags}
              onChangeText={setNewTags}
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

        {sortedNotes.map((note) => {
          const linked = describeLink(note);
          return (
            <View key={note.id} style={styles.noteCard}>
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
        })}
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
    minHeight: 120,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f4f7ff',
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
    textAlignVertical: 'top',
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
    color: '#f4f7ff',
    fontSize: 15,
    fontWeight: '700',
  },
  noteTitleMuted: {
    color: '#9ca9bf',
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
    color: '#f4f7ff',
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
    color: '#f4f7ff',
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
});
