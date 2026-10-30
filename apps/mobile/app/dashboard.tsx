import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { clearSession } from '../src/storage';
import { session } from '../src/session';
import { signOut } from '../src/signOut';
import { AlertWidgets } from '../src/components/AlertWidgets';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { useNotifications } from '../src/queries';
import { useTheme, type Palette } from '../src/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const user = session.getUser();
  const unreadCount = useNotifications(!!user).data?.unreadCount ?? 0;

  // <Redirect> navigates from an effect; calling router.replace during render is a side effect in render.
  if (!user) {
    return <Redirect href="/" />;
  }

  return (
    <ScreenFrame background={palette.background}>
      <ScrollView
        testID="dashboard-screen"
        style={[styles.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.kicker, { color: palette.accentSoft }]}>KitchenOS mobile</Text>
          <Text style={[styles.title, { color: palette.text }]}>Dashboard landing</Text>
          <Text style={styles.body}>{user.email}</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>Role: {user.role}</Text>
          <Text style={styles.note}>
            This is the mobile shell landing screen. The first live feature routes are tasks, recipes, guidelines, announcements, notes, inventory, team, and invites.
          </Text>

          <AlertWidgets />

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/tasks')}>
            <Text style={styles.secondaryButtonText}>Open tasks</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/recipes')}>
            <Text style={styles.secondaryButtonText}>Open recipes</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/guidelines')}>
            <Text style={styles.secondaryButtonText}>Open guidelines</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/announcements')}>
            <Text style={styles.secondaryButtonText}>Open announcements</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/notes')}>
            <Text style={styles.secondaryButtonText}>Open notes</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/inventory')}>
            <Text style={styles.secondaryButtonText}>Open inventory</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/team')}>
            <Text style={styles.secondaryButtonText}>Open team roster</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/invites')}>
            <Text style={styles.secondaryButtonText}>Open invites</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/shift-logs')}>
            <Text style={styles.secondaryButtonText}>Open shift log</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/notifications')}>
            <Text style={styles.secondaryButtonText}>Open notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge} testID="notifications-unread-badge">
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/settings')}>
            <Text style={styles.secondaryButtonText}>Open settings</Text>
          </Pressable>
          <Pressable style={[styles.primaryButton, { backgroundColor: palette.accent }]} onPress={() => void signOut(clearSession, (path) => router.replace(path))}>
            <Text style={[styles.primaryButtonText, { color: palette.onAccent }]}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
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
  body: {
    color: palette.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    color: palette.muted,
    fontSize: 14,
  },
  note: {
    color: palette.hint,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: palette.inputBackground,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: palette.danger,
  },
  badgeText: {
    color: palette.onAccent,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
