import { StyleSheet, Text, View } from 'react-native';
import type { AuthResponseDto } from '@kitchenos/shared';

const demoSession: AuthResponseDto = {
  accessToken: 'mobile-demo-token',
  user: {
    id: 'mobile-demo-user',
    email: 'mobile@kitchenos.local',
    organizationId: 'mobile-org',
    kitchenId: 'mobile-kitchen',
    role: 'OWNER',
  },
};

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>KitchenOS mobile scaffold</Text>
      <Text style={styles.title}>Shared core, separate shells</Text>
      <Text style={styles.body}>
        {demoSession.user.email} is flowing through the shared auth DTO and the Expo Router shell.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0e1116',
  },
  kicker: {
    marginBottom: 12,
    color: '#8aa4ff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f5f7ff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    marginTop: 16,
    maxWidth: 360,
    color: '#c7d0e0',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
