import { Platform } from 'react-native';

function devApiBase(platform: string): string {
  if (platform === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export function resolveApiBase(env: string | undefined, isDev: boolean, platform: string): string {
  const configured = env?.trim();

  if (isDev) {
    return configured || devApiBase(platform);
  }

  if (!configured) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set for non-development builds');
  }

  if (!configured.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an https:// URL for non-development builds');
  }

  return configured;
}

export const API_BASE = resolveApiBase(process.env.EXPO_PUBLIC_API_BASE_URL, __DEV__, Platform.OS);
