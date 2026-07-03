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
  };
}
