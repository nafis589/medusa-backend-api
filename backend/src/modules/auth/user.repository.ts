import type { IUserRepository } from './user.repository.interface';
import type { User, CreateUserData } from './user.entity';
import { getPool } from '@shared/utils/db';
import type mysql from 'mysql2/promise';

export class UserRepository implements IUserRepository {
  private get pool(): mysql.Pool {
    return getPool();
  }

  async findById(id: string): Promise<User | null> {
    const [rows] = await this.pool.query('SELECT * FROM users WHERE id = ?', [id]);
    const results = rows as User[];
    return results.length > 0 ? results[0] : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await this.pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const results = rows as User[];
    return results.length > 0 ? results[0] : null;
  }

  async create(data: CreateUserData & { id: string }): Promise<User> {
    await this.pool.query(
      'INSERT INTO users (id, email, password_hash, first_name, last_name, role, avatar_url, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.id,
        data.email,
        data.password_hash,
        data.first_name,
        data.last_name,
        data.role ?? 'BUYER',
        data.avatar_url ?? null,
        data.phone ?? null,
      ]
    );

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error(`Failed to find created user with id: ${data.id}`);
    }
    return created;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>): Promise<User> {
    const fields: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(data) as [string, unknown][]) {
      if (value !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }

    if (fields.length > 0) {
      params.push(id);
      await this.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Failed to find updated user with id: ${id}`);
    }
    return updated;
  }
}
