import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listMembers, type TeamMember } from '../src/api';
import { session } from '../src/session';

export default function TeamScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.getUser()) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listMembers()
      .then((items) => {
        if (!cancelled) {
          setMembers(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load team');
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
  }, [router]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>KitchenOS mobile</Text>
            <Text style={styles.title}>Team roster</Text>
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          This screen uses the shared auth session token and authenticated API helper to load the team.
        </Text>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/invites')}>
          <Text style={styles.secondaryButtonText}>Open invites</Text>
        </Pressable>

        {loading && <Text style={styles.note}>Loading members...</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && !error && members.length === 0 && <Text style={styles.note}>No team members returned.</Text>}

        {members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={styles.memberIdentity}>
              <Text style={styles.memberEmail}>{member.email}</Text>
              <Text style={styles.memberMeta}>{member.id}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{member.role}</Text>
            </View>
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
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  memberIdentity: {
    flex: 1,
    gap: 2,
  },
  memberEmail: {
    color: '#ccd5e6',
    fontSize: 15,
    fontWeight: '700',
  },
  memberMeta: {
    color: '#9ca9bf',
    fontSize: 12,
  },
  badge: {
    alignSelf: 'center',
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
