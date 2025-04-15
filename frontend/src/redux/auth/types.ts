export enum UserType {
  Admin = 'Admin',
  Landlord = 'Landlord',
  Tenant = 'Tenant',
  Unknown = '',
}

export interface IAuthState {
  isAuthenticated: boolean;
  userType: UserType;
  JWT: string | null;
  userId: string | null;
  userName: string | null;
  email: string | null;
}
