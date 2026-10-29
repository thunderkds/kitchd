import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMember, revokeInvite, type PendingInvite } from '../src/api';
import { FormTextInput } from '../src/components/FormFields';
import { INVITABLE_ROLES, inviteSchema, type InviteFormValues, type InvitePayload } from '../src/schemas/invite';
import { queryLoadError, usePendingInvites } from '../src/queries';
import { restoreIfSessionUnchanged, sessionTokenAtStart } from '../src/optimisticRollback';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';
import type { UserRole } from '@kitchenos/shared';
import { ScreenFrame } from '../src/components/ScreenFrame';


export default function InvitesScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const canManage = caller?.role === 'OWNER' || caller?.role === 'ADMIN';

  const { control, handleSubmit, reset, watch, setValue } = useForm<InviteFormValues, undefined, InvitePayload>({
    defaultValues: { email: '', role: 'STAFF' },
    resolver: zodResolver(inviteSchema),
  });
  const role = watch('role');
  const queryClient = useQueryClient();
  const invitesQuery = usePendingInvites(!!caller && canManage);
  const invites = invitesQuery.data ?? [];
  const loading = invitesQuery.isLoading;
  const [saving, setSaving] = useState(false);
  const [actionError, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const error = actionError ?? queryLoadError(invitesQuery, 'Failed to load invites');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const inviteMutation = useMutation({
    mutationFn: ({ email: inviteEmail, role: inviteRole }: { email: string; role: UserRole }) =>
      inviteMember(inviteEmail, inviteRole),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites.all }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onMutate: async (id) => {
      const tokenAtStart = sessionTokenAtStart();
      await queryClient.cancelQueries({ queryKey: queryKeys.invites.all });
      const previous = queryClient.getQueryData<PendingInvite[]>(queryKeys.invites.list());
      queryClient.setQueryData<PendingInvite[]>(queryKeys.invites.list(), (current) =>
        current?.filter((item) => item.id !== id),
      );
      return { previous, tokenAtStart };
    },
    onError: (_error, _id, context) => {
      if (context) {
        restoreIfSessionUnchanged(queryClient, queryKeys.invites.list(), context.previous, context.tokenAtStart);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites.all }),
  });

  const handleInvite = handleSubmit(async ({ email, role: inviteRole }) => {
    if (!canManage) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const created = await inviteMutation.mutateAsync({ email, role: inviteRole });
      reset();
      setMessage(`Invite created for ${created.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setSaving(false);
    }
  });

  const handleRevoke = async (invite: PendingInvite) => {
    if (!canManage) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await revokeMutation.mutateAsync(invite.id);
      setMessage(`Revoked ${invite.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  if (!canManage) {
    return (
      <ScreenFrame>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.kicker}>KitchenOS mobile</Text>
            <Text style={styles.title}>Invites</Text>
            <Text style={styles.note}>Invite management is available to Owners and Admins only.</Text>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.kicker}>KitchenOS mobile</Text>
              <Text style={styles.title}>Invites</Text>
            </View>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Create or revoke pending invites. The invitation token is returned by the API and can be shared out-of-band.
          </Text>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/invite/accept')}>
            <Text style={styles.secondaryButtonText}>Open accept invite</Text>
          </Pressable>

          <FormTextInput
            control={control}
            name="email"
            style={styles.input}
            placeholder="Invite email"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={styles.segmentRow}>
            {INVITABLE_ROLES.map((candidate) => (
              <Pressable
                key={candidate}
                style={[styles.segmentButton, role === candidate && styles.segmentButtonActive]}
                onPress={() => setValue('role', candidate)}
              >
                <Text style={[styles.segmentText, role === candidate && styles.segmentTextActive]}>{candidate}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.primaryButton} disabled={saving} onPress={handleInvite}>
            <Text style={styles.primaryButtonText}>{saving ? 'Sending...' : 'Create invite'}</Text>
          </Pressable>

          {message && <Text style={styles.success}>{message}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}
          {loading && <Text style={styles.note}>Loading invites...</Text>}

          {!loading && invites.length === 0 && <Text style={styles.note}>No pending invites.</Text>}

          {invites.map((invite) => (
            <View key={invite.id} style={styles.inviteRow}>
              <View style={styles.inviteIdentity}>
                <Text style={styles.inviteEmail}>{invite.email}</Text>
                <Text style={styles.inviteMeta}>{invite.role}</Text>
                <Text style={styles.inviteMeta}>{invite.status}</Text>
              </View>
              <Pressable style={styles.revokeButton} onPress={() => handleRevoke(invite)}>
                <Text style={styles.revokeButtonText}>Revoke</Text>
              </Pressable>
            </View>
          ))}
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
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f4f7ff',
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  segmentButton: {
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
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
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  inviteIdentity: {
    flex: 1,
    gap: 2,
  },
  inviteEmail: {
    color: '#ccd5e6',
    fontSize: 15,
    fontWeight: '700',
  },
  inviteMeta: {
    color: '#9ca9bf',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  revokeButton: {
    alignSelf: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#2d374b',
  },
  revokeButtonText: {
    color: '#f4f7ff',
    fontSize: 14,
    fontWeight: '700',
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
