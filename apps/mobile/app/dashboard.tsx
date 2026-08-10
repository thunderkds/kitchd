import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { session } from '../src/session';

export default function DashboardScreen() {
  const router = useRouter();
  const user = session.getUser();

  if (!user) {
    router.replace('/');
    return null;
  }

  const signOut = () => {
    session.clearToken();
    session.clearUser();
    router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>KitchenOS mobile</Text>
        <Text style={styles.title}>Dashboard landing</Text>
        <Text style={styles.body}>{user.email}</Text>
        <Text style={styles.meta}>Role: {user.role}</Text>
        <Text style={styles.note}>
          This is the mobile shell landing screen. The first live feature routes are tasks, recipes, guidelines, announcements, notes, inventory, team, and invites.
        </Text>

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
        <Pressable style={styles.primaryButton} onPress={signOut}>
          <Text style={styles.primaryButtonText}>Sign out</Text>
        </Pressable>
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
  body: {
    color: '#ccd5e6',
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    color: '#9ca9bf',
    fontSize: 14,
  },
  note: {
    color: '#8f9db4',
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: {
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
