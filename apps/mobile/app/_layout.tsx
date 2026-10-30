import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { queryClient } from '../src/queryClient';
import { startRealtime } from '../src/realtime';
import { sessionReady } from '../src/storage';
import { useTheme } from '../src/theme';

// Rendered before the session is read, so there is usually no user yet and this resolves the default (Simple).
// No provider is needed: ThemeContext defaults to the module store.
function BootScreen() {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.background,
      }}
    >
      <Text
        style={{
          color: palette.text,
          fontSize: 18,
          fontWeight: '700',
        }}
      >
        Loading KitchenOS...
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stopRealtime: (() => void) | undefined;

    sessionReady.finally(() => {
      if (!cancelled) {
        // Connects only if a token exists; follows login, logout and AppState from here on.
        stopRealtime = startRealtime();
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      stopRealtime?.();
    };
  }, []);

  if (!ready) {
    return <BootScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
