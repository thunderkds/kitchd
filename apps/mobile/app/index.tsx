import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AuthResponseDto, StoredUser } from '@kitchenos/shared';
import { API_BASE } from '../src/apiBase';
import { session, toStoredUser } from '../src/session';

type Mode = 'login' | 'signup';

function buildPayload(mode: Mode, email: string, password: string, organizationName: string, kitchenName: string) {
  if (mode === 'signup') {
    return { email, password, organizationName, kitchenName };
  }

  return { email, password };
}

export default function HomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => session.getUser());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signedIn = currentUser !== null;

  useEffect(() => {
    if (signedIn) {
      router.replace('/dashboard');
    }
  }, [router, signedIn]);

  const submit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}${mode === 'signup' ? '/auth/signup' : '/auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(mode, email, password, organizationName, kitchenName)),
      });
      const data = (await res.json()) as AuthResponseDto;
      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? 'Request failed');
      }

      const storedUser = toStoredUser(data.user);
      session.setToken(data.accessToken);
      session.setUser(storedUser);
      setCurrentUser(storedUser);
      router.replace('/dashboard');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (signedIn) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Redirecting to dashboard</Text>
          <Text style={styles.body}>{currentUser?.email}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>KitchenOS mobile</Text>
        <Text style={styles.title}>Shared core, separate shells</Text>
        <Text style={styles.body}>
          Log in or sign up against the API using the shared auth DTO and shared session store.
        </Text>

        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentButton, mode === 'signup' && styles.segmentButtonActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>Sign up</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButton, mode === 'login' && styles.segmentButtonActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Log in</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {mode === 'signup' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Organization name"
              value={organizationName}
              onChangeText={setOrganizationName}
            />
            <TextInput
              style={styles.input}
              placeholder="Kitchen name"
              value={kitchenName}
              onChangeText={setKitchenName}
            />
          </>
        )}

        <Pressable style={styles.primaryButton} disabled={loading} onPress={submit}>
          <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}</Text>
        </Pressable>

        {message && <Text style={styles.note}>{message}</Text>}
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
    fontSize: 15,
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
  note: {
    color: '#8f9db4',
    fontSize: 13,
    lineHeight: 18,
  },
});
