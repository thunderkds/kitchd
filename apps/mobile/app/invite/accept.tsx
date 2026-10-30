import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { acceptInvite } from '../../src/api';
import { FormTextInput } from '../../src/components/FormFields';
import {
  acceptInviteSchema,
  type AcceptInviteFormValues,
  type AcceptInvitePayload,
} from '../../src/schemas/invite';
import { persistSession } from '../../src/storage';
import { session, toStoredUser } from '../../src/session';
import { inviteTokenFromParam } from '../../src/inviteToken';
import { ScreenFrame } from '../../src/components/ScreenFrame';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialToken = inviteTokenFromParam(params.token);

  const { control, handleSubmit, setValue } = useForm<AcceptInviteFormValues, undefined, AcceptInvitePayload>({
    defaultValues: { token: initialToken ?? '', password: '' },
    resolver: zodResolver(acceptInviteSchema),
  });
  // Read once at mount, like the web page: accepting replaces whoever is signed in, so say so up front.
  const [currentUser] = useState(() => session.getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Depend on the route param only: depending on `token` would reset the field on every keystroke.
  useEffect(() => {
    if (initialToken) {
      setValue('token', initialToken);
    }
  }, [initialToken, setValue]);

  const submit = handleSubmit(async ({ token, password }) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await acceptInvite(token, password);
      const storedUser = toStoredUser(result.user);
      await persistSession(result.accessToken, storedUser);
      setMessage(`Accepted invite for ${storedUser.email}`);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  });

  return (
    <ScreenFrame>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Accept invite</Text>
          <Text style={styles.body}>
            Paste the invite token from the owner or admin. The mobile app uses the same public accept endpoint as the web flow.
          </Text>

          {currentUser && (
            <Text style={styles.notice}>
              You are signed in as {currentUser.email}. Accepting this invitation will sign you in as the invited user.
            </Text>
          )}

          <FormTextInput
            control={control}
            name="token"
            style={styles.input}
            placeholder="Invite token"
            placeholderTextColor="#6f7c92"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FormTextInput
            control={control}
            name="password"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6f7c92"
            secureTextEntry
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
  notice: {
    color: '#ffd28a',
    fontSize: 14,
    lineHeight: 20,
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
