export type UserRole = 'BUYER' | 'VENDOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  created_at?: Date;
  updated_at?: Date;
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
