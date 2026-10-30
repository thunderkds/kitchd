import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { markNotificationsRead } from '../src/api';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { queryLoadError, useNotifications } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { useTheme, type Palette } from '../src/theme';

const TYPE_LABEL = {
  MENTION: 'Mention',
  LOW_STOCK: 'Low stock',
  TASK_ASSIGNED: 'Task assigned',
} as const;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const caller = session.getUser();

  const queryClient = useQueryClient();
  const notificationsQuery = useNotifications(!!caller);
  const feed = notificationsQuery.data ?? null;
  const [actionError, setError] = useState<string | null>(null);
  const markReadMutation = useMutation({
    mutationFn: () => markNotificationsRead(),
    // A new attempt supersedes the previous failure.
    onMutate: () => setError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });

  const error = actionError ?? queryLoadError(notificationsQuery, 'Failed to load notifications');

  // A later successful fetch means the server is reachable again, so a stale mark-read failure goes away.
  // Subscribed to the cache rather than derived from render state: a refetch that returns identical data
  // can finish without re-rendering this screen or changing dataUpdatedAt.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'success' &&
          event.query.queryKey[0] === queryKeys.notifications.all[0]
        ) {
          setError(null);
        }
      }),
    [queryClient],
  );

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const handleMarkRead = async () => {
    if (markReadMutation.isPending) return;

    try {
      await markReadMutation.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notifications read');
    }
  };

  if (!caller) {
    return null;
  }

  const notifications = feed?.notifications ?? [];

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      {feed !== null && feed.unreadCount > 0 && (
        <Pressable style={styles.primaryButton} disabled={markReadMutation.isPending} onPress={handleMarkRead}>
          <Text style={styles.primaryButtonText}>
            {markReadMutation.isPending ? 'Marking...' : 'Mark all as read'}
          </Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {feed === null && !error && <Text style={styles.note}>Loading notifications...</Text>}
      {feed !== null && feed.notifications.length === 0 && <Text style={styles.note}>No notifications yet.</Text>}
    </View>
  );

  return (
    <ScreenFrame background={palette.background}>
      <FlashList
        data={notifications}
        keyExtractor={(notification) => notification.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: notification }) => (
          <View style={styles.listRow}>
            <Text style={styles.meta}>
              {TYPE_LABEL[notification.type] ?? notification.type} {formatDate(notification.createdAt)}
            </Text>
            <Text style={notification.read ? styles.bodyText : styles.bodyTextUnread}>{notification.body}</Text>
            <Text
              testID={`notification-${notification.id}-state`}
              style={notification.read ? styles.stateRead : styles.stateUnread}
            >
              {notification.read ? 'Read' : 'Unread'}
            </Text>
          </View>
        )}
      />
    </ScreenFrame>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
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
  listRow: {
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  bodyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyTextUnread: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  stateUnread: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  stateRead: {
    color: '#6f7c92',
    fontSize: 12,
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
