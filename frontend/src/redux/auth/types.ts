export enum UserType {
  Initial = '',
  Pending = 'Pending',
  Admin = 'Admin',
  Landlord = 'Landlord',
  Tenant = 'Tenant',
}

export interface IAuthState {
  isAuthenticated: boolean;
  userType: UserType;
  JWT: string | null;
  userId: string | null;
  userName: string | null;
  email: string | null;
}
