import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { acceptInvite } from '../../src/api';
import { persistSession } from '../../src/storage';
import { toStoredUser } from '../../src/session';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialToken = Array.isArray(params.token) ? params.token[0] : params.token;

  const [token, setToken] = useState(initialToken ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken && initialToken !== token) {
      setToken(initialToken);
    }
  }, [initialToken, token]);

  const submit = async () => {
    const trimmedToken = token.trim();
    if (!trimmedToken || !password) {
      setError('Token and password are required');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await acceptInvite(trimmedToken, password);
      const storedUser = toStoredUser(result.user);
      await persistSession(result.accessToken, storedUser);
      setMessage(`Accepted invite for ${storedUser.email}`);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>KitchenOS mobile</Text>
        <Text style={styles.title}>Accept invite</Text>
        <Text style={styles.body}>
          Paste the invite token from the owner or admin. The mobile app uses the same public accept endpoint as the web flow.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Invite token"
          placeholderTextColor="#6f7c92"
          autoCapitalize="none"
          autoCorrect={false}
          value={token}
          onChangeText={setToken}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6f7c92"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.primaryButton} disabled={loading} onPress={submit}>
          <Text style={styles.primaryButtonText}>{loading ? 'Accepting...' : 'Accept invite'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>

        {message && <Text style={styles.success}>{message}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
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
    fontSize: 15,
    lineHeight: 22,
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
  success: {
    color: '#93e0a6',
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: '#ff8c8c',
    fontSize: 13,
    lineHeight: 18,
  },
});
