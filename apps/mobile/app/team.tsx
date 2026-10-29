import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { UserRole } from '@kitchenos/shared';
import type { TeamMember } from '../src/api';
import { queryLoadError, useMembers, useRemoveMember, useUpdateMemberRole } from '../src/queries';
import { session } from '../src/session';
import { ASSIGNABLE_ROLES, canManageMember, canManageTeam } from '../src/teamRules';

export default function TeamScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const signedIn = !!caller;
  // GET /users is OWNER/ADMIN only (403 otherwise), so other roles never fetch it; same as web.
  const canManage = canManageTeam(caller?.role);
  const membersQuery = useMembers(signedIn && canManage);
  const members = membersQuery.data ?? [];
  const loading = membersQuery.isLoading;
  const error = queryLoadError(membersQuery, 'Failed to load team');
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const [actionError, setActionError] = useState<string | null>(null);

  const changeRole = (member: TeamMember, role: UserRole) => {
    if (role === member.role) {
      return;
    }
    setActionError(null);
    updateRole.mutate(
      { id: member.id, role },
      { onError: (err) => setActionError(err instanceof Error ? err.message : 'Failed to update role') },
    );
  };

  const confirmRemove = (member: TeamMember) => {
    Alert.alert('Remove member', `Remove ${member.email} from the team? They will lose access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setActionError(null);
          remove.mutate(member.id, {
            onError: (err) => setActionError(err instanceof Error ? err.message : 'Failed to remove member'),
          });
        },
      },
    ]);
  };

  useEffect(() => {
    if (!signedIn) {
      router.replace('/');
    }
  }, [router, signedIn]);

  if (signedIn && !canManage) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.kicker}>KitchenOS mobile</Text>
          <Text style={styles.title}>Team roster</Text>
          <Text style={styles.note}>Team management is available to Owners and Admins only.</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
        {actionError && <Text style={styles.error}>{actionError}</Text>}

        {!loading && !error && members.length === 0 && <Text style={styles.note}>No team members returned.</Text>}

        {members.map((member) => (
          <View key={member.id} style={styles.memberBlock}>
            <View style={styles.memberRow}>
              <View style={styles.memberIdentity}>
                <Text style={styles.memberEmail}>{member.email}</Text>
                <Text style={styles.memberMeta}>{member.id}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{member.role}</Text>
              </View>
            </View>
            {canManageMember(caller, member) && (
              <View style={styles.controlsRow}>
                {ASSIGNABLE_ROLES.map((role) => (
                  <Pressable
                    key={role}
                    accessibilityRole="button"
                    accessibilityLabel={`Set role of ${member.email} to ${role}`}
                    accessibilityState={{ selected: role === member.role }}
                    style={[styles.roleChip, role === member.role && styles.roleChipActive]}
                    onPress={() => changeRole(member, role)}
                  >
                    <Text style={[styles.roleChipText, role === member.role && styles.roleChipTextActive]}>{role}</Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${member.email}`}
                  style={styles.removeButton}
                  onPress={() => confirmRemove(member)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            )}
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
  memberBlock: {
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2d374b',
    backgroundColor: '#101521',
  },
  roleChipActive: {
    backgroundColor: '#6b8cff',
    borderColor: '#6b8cff',
  },
  roleChipText: {
    color: '#c1cbe0',
    fontSize: 13,
    fontWeight: '700',
  },
  roleChipTextActive: {
    color: '#ffffff',
  },
  removeButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ff8c8c',
    backgroundColor: '#101521',
  },
  removeButtonText: {
    color: '#ff8c8c',
    fontSize: 13,
    fontWeight: '800',
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
