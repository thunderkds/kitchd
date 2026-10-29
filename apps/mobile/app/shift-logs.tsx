import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createShiftLog, type CreateShiftLogInput, type Shift } from '../src/api';
import { queryErrorMessage, useShiftLogs } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';

// Viewer is read-only (FR-018): an explicit allow-list, so an unknown role gets no composer.
const WRITE_ROLES = ['OWNER', 'ADMIN', 'CHEF', 'STAFF'];

const SHIFTS: { value: Shift; label: string }[] = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'EVENING', label: 'Evening' },
];

function labelShift(shift: Shift): string {
  return shift.charAt(0) + shift.slice(1).toLowerCase();
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
}

export default function ShiftLogsScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const canWrite = !!caller && WRITE_ROLES.includes(caller.role);

  const queryClient = useQueryClient();
  const logsQuery = useShiftLogs(!!caller);
  const logs = logsQuery.data ?? null;
  const createMutation = useMutation({
    mutationFn: (input: CreateShiftLogInput) => createShiftLog(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shiftLogs.all }),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift>('MORNING');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const loadError = queryErrorMessage(logsQuery.error, 'Failed to load shift logs');

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const handleCreate = async () => {
    if (!canWrite || saving) return;

    const cleanBody = body.trim();
    if (!cleanBody) {
      setFormError('Shift log body is required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await createMutation.mutateAsync({ shift, body: cleanBody });
      setShift('MORNING');
      setBody('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create shift log');
    } finally {
      setSaving(false);
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
            <Text style={styles.title}>Shift Log</Text>
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>Read the kitchen's shift handover notes, newest first.</Text>

        {canWrite && (
          <View style={styles.formCard} testID="shift-log-form">
            <Text style={styles.sectionTitle}>New shift log</Text>
            <View style={styles.shiftRow}>
              {SHIFTS.map((option) => {
                const selected = shift === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} shift`}
                    accessibilityState={{ selected }}
                    style={[styles.shiftButton, selected && styles.shiftButtonSelected]}
                    onPress={() => setShift(option.value)}
                  >
                    <Text style={[styles.shiftButtonText, selected && styles.shiftButtonTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.multiLineInput}
              accessibilityLabel="Shift log body"
              placeholder="What should the next shift know?"
              placeholderTextColor="#6f7c92"
              multiline
              value={body}
              onChangeText={(text) => {
                setBody(text);
                setFormError(null);
              }}
            />
            {formError && <Text style={styles.error}>{formError}</Text>}
            <Pressable style={styles.primaryButton} disabled={saving} onPress={handleCreate}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Add shift log'}</Text>
            </Pressable>
          </View>
        )}

        {loadError && <Text style={styles.error}>{loadError}</Text>}
        {logs === null && !loadError && <Text style={styles.note}>Loading shift logs...</Text>}
        {logs !== null && logs.length === 0 && <Text style={styles.note}>No shift logs yet.</Text>}

        {logs !== null && logs.length > 0 && (
          <View style={styles.list}>
            {logs.map((log) => (
              <View key={log.id} style={styles.listRow}>
                <View style={styles.rowHeader}>
                  <Text style={styles.listTitle} testID="shift-log-shift">{labelShift(log.shift)}</Text>
                  <Text style={styles.meta}>{formatCreatedAt(log.createdAt)}</Text>
                </View>
                <Text style={styles.bodyText} testID="shift-log-body">
                  {log.body}
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
  sectionTitle: {
    color: '#f4f7ff',
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    gap: 0,
  },
  listRow: {
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222b3a',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  listTitle: {
    color: '#f4f7ff',
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: '#ccd5e6',
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: '#9ca9bf',
    fontSize: 12,
  },
  multiLineInput: {
    minHeight: 128,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f4f7ff',
    backgroundColor: '#171c26',
    borderWidth: 1,
    borderColor: '#2d374b',
    textAlignVertical: 'top',
  },
  formCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#101521',
    borderWidth: 1,
    borderColor: '#273044',
  },
  shiftRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shiftButton: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2d374b',
    backgroundColor: '#101521',
  },
  shiftButtonSelected: {
    borderColor: '#6b8cff',
    backgroundColor: '#1f2a4d',
  },
  shiftButtonText: {
    color: '#9ca9bf',
    fontSize: 15,
    fontWeight: '700',
  },
  shiftButtonTextSelected: {
    color: '#f4f7ff',
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
    minHeight: 44,
    justifyContent: 'center',
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
