import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAnnouncement } from '../src/api';
import { FormTextInput } from '../src/components/FormFields';
import {
  announcementSchema,
  type AnnouncementFormValues,
  type AnnouncementPayload,
} from '../src/schemas/announcement';
import { queryLoadError, useAnnouncements } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { useTheme } from '../src/theme';
import { ScreenFrame } from '../src/components/ScreenFrame';

const BROADCAST_ROLES = ['OWNER', 'CHEF'] as const;

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const caller = session.getUser();
  const canBroadcast = !!caller && BROADCAST_ROLES.includes(caller.role as (typeof BROADCAST_ROLES)[number]);

  const queryClient = useQueryClient();
  const announcementsQuery = useAnnouncements(!!caller);
  const announcements = announcementsQuery.data ?? null;
  const broadcastMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
  });
  const [actionError, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<AnnouncementFormValues, undefined, AnnouncementPayload>({
    defaultValues: { title: '', body: '' },
    resolver: zodResolver(announcementSchema),
  });
  const [saving, setSaving] = useState(false);

  const error = actionError ?? queryLoadError(announcementsQuery, 'Failed to load announcements');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const openForm = () => {
    if (!canBroadcast) return;
    reset();
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    reset();
  };

  const handleBroadcast = handleSubmit(async (announcement) => {
    if (!canBroadcast || saving) return;

    setSaving(true);
    setError(null);

    try {
      await broadcastMutation.mutateAsync(announcement);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast announcement');
    } finally {
      setSaving(false);
    }
  });

  if (!caller) {
    return null;
  }

  return (
    <ScreenFrame background={palette.background}>
      <ScrollView testID="announcements-screen" style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.kicker, { color: palette.accentSoft }]}>KitchenOS mobile</Text>
              <Text style={[styles.title, { color: palette.text }]}>Announcements</Text>
            </View>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Read the kitchen history, and broadcast new announcements if your role allows it.
          </Text>

          {canBroadcast && (
            <Pressable style={[styles.primaryButton, { backgroundColor: palette.accent }]} onPress={openForm}>
              <Text style={[styles.primaryButtonText, { color: palette.onAccent }]}>New announcement</Text>
            </Pressable>
          )}

          {formOpen && canBroadcast && (
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Broadcast announcement</Text>
              <FormTextInput
                control={control}
                name="title"
                style={styles.input}
                placeholder="Title"
                placeholderTextColor="#6f7c92"
              />
              <FormTextInput
                control={control}
                name="body"
                style={styles.multiLineInput}
                placeholder="Message"
                placeholderTextColor="#6f7c92"
                multiline
              />
              <View style={styles.formActions}>
                <Pressable style={styles.secondaryButton} onPress={closeForm}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.primaryButton, { backgroundColor: palette.accent }]} disabled={saving} onPress={handleBroadcast}>
                  <Text style={[styles.primaryButtonText, { color: palette.onAccent }]}>{saving ? 'Sending...' : 'Broadcast'}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
          {announcements === null && !error && <Text style={styles.note}>Loading announcements...</Text>}
          {announcements !== null && announcements.length === 0 && <Text style={styles.note}>No announcements yet.</Text>}

          {announcements !== null && announcements.length > 0 && (
            <View style={styles.list}>
              {announcements.map((announcement) => (
                <View key={announcement.id} style={styles.listRow}>
                  <Text style={[styles.listTitle, { color: palette.text }]}>{announcement.title}</Text>
                  <Text style={styles.bodyText}>{announcement.body}</Text>
                  <Text style={[styles.meta, { color: palette.muted }]}>Read by {announcement.readBy.length}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0d1016',
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
  list: {
    gap: 0,
  },
  listRow: {
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  listTitle: {
    color: '#f4f7ff',
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: '#ccd5e6',
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: '#9ca9bf',
    fontSize: 12,
    textTransform: 'uppercase',
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
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: '#6b8cff',
  },
  primaryButtonText: {
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
