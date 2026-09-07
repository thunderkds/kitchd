import {
  createSessionStore,
  type AuthResponseDto,
  type StoredUser,
  type ThemePreferenceId,
} from '@kitchenos/shared';
import { createSessionStorage } from './storage';

export const session = createSessionStore(createSessionStorage());

function normalizeThemePreference(value: string | null | undefined): ThemePreferenceId | undefined {
  if (value === 'simple' || value === 'dark-neon') {
    return value;
  }

  return undefined;
}

export function toStoredUser(user: AuthResponseDto['user']): StoredUser {
  const storedUser: StoredUser = {
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    kitchenId: user.kitchenId,
    role: user.role,
  };

  const themePreference = normalizeThemePreference(user.themePreference);
  if (themePreference) {
    storedUser.themePreference = themePreference;
  }

  return storedUser;
}
