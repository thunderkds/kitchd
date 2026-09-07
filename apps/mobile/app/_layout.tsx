import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { sessionReady } from '../src/storage';

function BootScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d1016',
      }}
    >
      <Text
        style={{
          color: '#f4f7ff',
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

    sessionReady.finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <BootScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
