import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationsRead } from '../src/api';
import { queryLoadError, useNotifications } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';

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

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
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

        {feed !== null && feed.notifications.length > 0 && (
          <View style={styles.list}>
            {feed.notifications.map((notification) => (
              <View key={notification.id} style={styles.listRow}>
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
            ))}
          </View>
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
  list: {
    gap: 0,
  },
  listRow: {
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  bodyText: {
    color: '#9ca9bf',
    fontSize: 14,
    lineHeight: 20,
  },
  bodyTextUnread: {
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  meta: {
    color: '#9ca9bf',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  stateUnread: {
    color: '#86a0ff',
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
