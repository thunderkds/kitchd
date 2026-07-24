export interface SignupRequestDto {
  email: string;
  password: string;
  organizationName: string;
  kitchenName: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    organizationId: string;
    kitchenId: string;
    // T018 — Dashboard needs role client-side to decide "my tasks" (Staff/
    // Viewer) vs "all Kitchen tasks" (Owner/Admin/Chef). Matches the shape
    // already returned by AuthService.buildAuthResult (this type was stale).
    role: 'OWNER' | 'ADMIN' | 'CHEF' | 'STAFF' | 'VIEWER';
  };
}
