import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthResponseDto, StoredUser } from '@kitchenos/shared';
import { API_BASE } from '../src/apiBase';
import { FormTextInput } from '../src/components/FormFields';
import { loginSchema, signupSchema, type AuthFormValues } from '../src/schemas/auth';
import { persistSession } from '../src/storage';
import { session, toStoredUser } from '../src/session';
import { useTheme, type Palette } from '../src/theme';
import { ScreenFrame } from '../src/components/ScreenFrame';

type Mode = 'login' | 'signup';

const EMPTY_FORM: AuthFormValues = { email: '', password: '', organizationName: '', kitchenName: '' };

// The login schema only knows two of the form's four inputs and strips the rest from its output.
const RESOLVERS: Record<Mode, Resolver<AuthFormValues>> = {
  login: zodResolver(loginSchema) as unknown as Resolver<AuthFormValues>,
  signup: zodResolver(signupSchema),
};

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [mode, setMode] = useState<Mode>('signup');
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => session.getUser());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signedIn = currentUser !== null;

  // Login and signup share the inputs but not the rules (login must not enforce the signup password
  // minimum), so the resolver follows the mode. The schema output is exactly the request body.
  const { control, handleSubmit, clearErrors } = useForm<AuthFormValues>({
    defaultValues: EMPTY_FORM,
    resolver: (values, context, options) => RESOLVERS[mode](values, context, options),
  });

  useEffect(() => {
    if (signedIn) {
      router.replace('/dashboard');
    }
  }, [router, signedIn]);

  const changeMode = (next: Mode) => {
    setMode(next);
    clearErrors();
  };

  const submit = handleSubmit(async (payload) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}${mode === 'signup' ? '/auth/signup' : '/auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // A proxy or gateway error is often HTML, so a body that is not JSON must not surface as a SyntaxError.
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as AuthResponseDto;

      const storedUser = toStoredUser(data.user);
      await persistSession(data.accessToken, storedUser);
      setCurrentUser(storedUser);
      router.replace('/dashboard');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  });

  if (signedIn) {
    return (
      <ScreenFrame background={palette.background}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.kicker}>KitchenOS mobile</Text>
            <Text style={styles.title}>Redirecting to dashboard</Text>
            <Text style={styles.body}>{currentUser?.email}</Text>
          </View>
        </ScrollView>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame background={palette.background}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Shared core, separate shells</Text>
          <Text style={styles.body}>
            Log in or sign up against the API using the shared auth DTO and shared session store.
          </Text>

          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segmentButton, mode === 'signup' && styles.segmentButtonActive]}
              onPress={() => changeMode('signup')}
            >
              <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>Sign up</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentButton, mode === 'login' && styles.segmentButtonActive]}
              onPress={() => changeMode('login')}
            >
              <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>Log in</Text>
            </Pressable>
          </View>

          <FormTextInput
            control={control}
            name="email"
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormTextInput control={control} name="password" style={styles.input} placeholder="Password" secureTextEntry />
          {mode === 'signup' && (
            <>
              <FormTextInput control={control} name="organizationName" style={styles.input} placeholder="Organization name" />
              <FormTextInput control={control} name="kitchenName" style={styles.input} placeholder="Kitchen name" />
            </>
          )}

          <Pressable style={styles.primaryButton} disabled={loading} onPress={submit}>
            <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}</Text>
          </Pressable>

          {message && <Text style={styles.note}>{message}</Text>}

          {/* M017 / T043: signup creates a NEW org, so an invitee must go to invite acceptance
              instead. Works signed-out and without the deep link (token pasted manually). */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="I have an invite"
            style={styles.linkButton}
            onPress={() => router.push('/invite/accept')}
          >
            <Text style={styles.linkButtonText}>I have an invite</Text>
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
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  segmentText: {
    color: '#c1cbe0',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: palette.onAccent,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.text,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    color: palette.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    color: '#8f9db4',
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  linkButtonText: {
    color: palette.accentSoft,
    fontSize: 15,
    fontWeight: '700',
  },
});
