import { Platform } from 'react-native';

function defaultApiBase(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultApiBase();
