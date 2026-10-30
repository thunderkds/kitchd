import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { createShiftLog, type CreateShiftLogInput, type Shift } from '../src/api';
import { ScreenFrame } from '../src/components/ScreenFrame';
import { queryErrorMessage, useShiftLogs } from '../src/queries';
import { queryKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { useTheme, type Palette } from '../src/theme';

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
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
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

  const header = (
    <View style={styles.header}>
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
    </View>
  );

  return (
    <ScreenFrame background={palette.background}>
      <FlashList
        data={logs ?? []}
        keyExtractor={(log) => log.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: log }) => (
          <View style={styles.listRow}>
            <View style={styles.rowHeader}>
              <Text style={styles.listTitle} testID="shift-log-shift">{labelShift(log.shift)}</Text>
              <Text style={styles.meta}>{formatCreatedAt(log.createdAt)}</Text>
            </View>
            <Text style={styles.bodyText} testID="shift-log-body">
              {log.body}
            </Text>
          </View>
        )}
      />
    </ScreenFrame>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  content: {
    padding: 24,
  },
  header: {
    gap: 14,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
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
  note: {
    color: '#8f9db4',
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
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
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: '#ccd5e6',
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
  },
  multiLineInput: {
    minHeight: 128,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.text,
    backgroundColor: palette.surface,
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
    borderColor: palette.border,
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
    borderColor: palette.accent,
    backgroundColor: '#1f2a4d',
  },
  shiftButtonText: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  shiftButtonTextSelected: {
    color: palette.text,
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
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
