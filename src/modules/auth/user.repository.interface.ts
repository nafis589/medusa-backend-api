import type { User, CreateUserData, UserStatus } from './user.entity';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData & { id: string }): Promise<User>;
  update(id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>): Promise<User>;
}
