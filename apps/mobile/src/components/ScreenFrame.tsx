import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * Shared screen shell (M010): keeps content out of the notch, status bar and home indicator, and
 * lifts it above the on-screen keyboard. Expo Router already mounts the SafeAreaProvider at the root.
 * The insets are painted with the screen's own background (default: the theme's) so there is no visible band.
 */
export function ScreenFrame({ children, background }: { children: ReactNode; background?: string }) {
  const { palette } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: background ?? palette.background }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
