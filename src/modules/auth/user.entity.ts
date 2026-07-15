export type UserRole = 'BUYER' | 'VENDOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status?: UserStatus;
  avatar_url: string | null;
  phone: string | null;
  created_at?: Date;
  updated_at?: Date;
  last_login_at?: Date | null;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
  avatar_url?: string | null;
  phone?: string | null;
}
