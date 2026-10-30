import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThemePreferenceId } from '@kitchenos/shared';
import { renameKitchen, updateTheme } from '../src/api';
import { queryErrorMessage, useKitchen } from '../src/queries';
import { kitchenKeys } from '../src/queryKeys';
import { session } from '../src/session';
import { THEME_OPTIONS, useTheme } from '../src/theme';
import { ScreenFrame } from '../src/components/ScreenFrame';

export default function SettingsScreen() {
  const router = useRouter();
  const caller = session.getUser();
  const { preference, palette, setPreference } = useTheme();
  const queryClient = useQueryClient();
  const canRename = caller?.role === 'CHEF';

  const kitchenQuery = useKitchen(caller?.kitchenId, !!caller);
  const savedName = kitchenQuery.data?.name ?? '';
  // null = untouched: show the saved name; a string = what the CHEF has typed.
  const [draft, setDraft] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameStatus, setRenameStatus] = useState<string | null>(null);
  const nameValue = draft ?? savedName;

  useEffect(() => {
    if (!caller) {
      router.replace('/');
    }
  }, [caller, router]);

  const themeMutation = useMutation({
    mutationFn: (next: ThemePreferenceId) => updateTheme(next),
    // Only a saved value changes the stored user and the palette; a failure leaves the old one.
    onSuccess: (_result, next) => setPreference(next),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameKitchen(caller!.kitchenId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kitchenKeys.all }),
  });

  const handleRename = async () => {
    if (!canRename || renameMutation.isPending) return;

    const next = nameValue.trim();
    if (!next) {
      setRenameError('Kitchen name is required.');
      return;
    }
    if (next === savedName) {
      setRenameStatus('Kitchen name is unchanged.');
      return;
    }

    setRenameError(null);
    setRenameStatus(null);
    try {
      await renameMutation.mutateAsync(next);
      setDraft(null);
      setRenameStatus('Kitchen renamed successfully.');
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename kitchen');
    }
  };

  const kitchenLoadError = queryErrorMessage(kitchenQuery.error, 'Failed to load kitchen');
  const themeError = queryErrorMessage(themeMutation.error, 'Failed to save theme');

  return (
    <ScreenFrame background={palette.background}>
      <ScrollView testID="settings-screen" style={[styles.screen, { backgroundColor: palette.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.kicker, { color: palette.accentSoft }]}>KitchenOS mobile</Text>
              <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.backButton, { borderColor: palette.border }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.backButtonText, { color: palette.text }]}>Back</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: palette.text }]}>Theme</Text>
          <Text style={[styles.note, { color: palette.muted }]}>
            Choose how KitchenOS looks. Your choice is saved to your account.
          </Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {THEME_OPTIONS.map((option) => {
              const isSelected = preference === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: isSelected, disabled: themeMutation.isPending }}
                  disabled={themeMutation.isPending}
                  style={[
                    styles.option,
                    { borderColor: isSelected ? palette.accent : palette.border, backgroundColor: palette.background },
                  ]}
                  onPress={() => {
                    if (!isSelected) themeMutation.mutate(option.id);
                  }}
                >
                  <Text style={[styles.optionLabel, { color: palette.text }]}>{option.label}</Text>
                  <Text style={[styles.optionDescription, { color: palette.muted }]}>{option.description}</Text>
                </Pressable>
              );
            })}
          </View>
          {themeError ? <Text style={[styles.error, { color: palette.danger }]}>{themeError}</Text> : null}

          <Text style={[styles.sectionTitle, { color: palette.text }]}>Kitchen</Text>
          {kitchenQuery.isLoading ? (
            <Text style={[styles.note, { color: palette.muted }]}>Loading kitchen...</Text>
          ) : kitchenLoadError ? (
            <Text style={[styles.error, { color: palette.danger }]}>{kitchenLoadError}</Text>
          ) : canRename ? (
            <>
              <TextInput
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.background }]}
                placeholder="Kitchen name"
                placeholderTextColor={palette.muted}
                value={nameValue}
                editable={!renameMutation.isPending}
                onChangeText={(value) => {
                  setDraft(value);
                  setRenameError(null);
                  setRenameStatus(null);
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save name"
                disabled={renameMutation.isPending}
                style={[styles.primaryButton, { backgroundColor: palette.accent }, renameMutation.isPending && styles.disabled]}
                onPress={() => void handleRename()}
              >
                <Text style={[styles.primaryButtonText, { color: palette.onAccent }]}>{renameMutation.isPending ? 'Saving...' : 'Save name'}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.kitchenName, { color: palette.text }]}>{savedName}</Text>
          )}
          {renameError ? <Text style={[styles.error, { color: palette.danger }]}>{renameError}</Text> : null}
          {renameStatus ? <Text style={[styles.note, { color: palette.muted }]}>{renameStatus}</Text> : null}
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
  },
  options: {
    gap: 10,
  },
  option: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionDescription: {
    fontSize: 12,
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
