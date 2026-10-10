import type { Row, SqlDatabase } from "../db/types.js";
import { insertRow } from "./base.js";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  full_name: string;
  email: string | null;
  role_id: number;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface UserWithRoleRow extends UserRow {
  role_name: string | null;
}

/** Safe projection for the admin users list -- never exposes password material. */
export interface RoleRow {
  id: number;
  name: string;
  description: string | null;
}

export interface UserSummaryRow {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role_id: number;
  role_name: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

/** A type alias (not an interface) so it carries an implicit index signature
 *  and can be passed straight to `insertRow`. */
export type NewUser = {
  username: string;
  full_name: string;
  email: string | null;
  password_hash: string;
  password_salt: string;
  role_id: number;
  is_active: number;
};

export interface UserUpdate {
  full_name?: string;
  email?: string | null;
  role_id?: number;
  is_active?: number;
  password_hash?: string;
  password_salt?: string;
}

export class UserRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findByUsername(username: string): Promise<UserRow | undefined> {
    return this.db.get<UserRow>("SELECT * FROM users WHERE username = ?", [username]);
  }

  async listWithRoles(): Promise<UserSummaryRow[]> {
    return this.db.all<UserSummaryRow>(
      `SELECT u.id, u.username, u.full_name, u.email, u.role_id, r.name AS role_name,
              u.is_active, u.last_login_at, u.created_at
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.username`,
    );
  }

  async findSummaryById(id: number): Promise<UserSummaryRow | undefined> {
    return this.db.get<UserSummaryRow>(
      `SELECT u.id, u.username, u.full_name, u.email, u.role_id, r.name AS role_name,
              u.is_active, u.last_login_at, u.created_at
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
  }

  async create(data: NewUser): Promise<number> {
    return insertRow(this.db, "users", data);
  }

  async update(id: number, data: UserUpdate): Promise<void> {
    const cols = Object.keys(data) as Array<keyof UserUpdate>;
    if (cols.length === 0) return;
    const assignments = cols.map((col) => `${col} = ?`).join(", ");
    await this.db.run(`UPDATE users SET ${assignments} WHERE id = ?`, [
      ...cols.map((col) => data[col] ?? null),
      id,
    ]);
  }

  async findRoleByName(name: string): Promise<Row | undefined> {
    return this.db.get<Row>("SELECT id, name, description FROM roles WHERE name = ?", [name]);
  }

  async findWithRoleById(id: number): Promise<UserWithRoleRow | undefined> {
    return this.db.get<UserWithRoleRow>(
      `SELECT u.*, r.name AS role_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id],
    );
  }

  async updateLastLogin(id: number, at: string): Promise<void> {
    await this.db.run("UPDATE users SET last_login_at = ? WHERE id = ?", [at, id]);
  }

  async updatePassword(id: number, salt: string, hash: string): Promise<void> {
    await this.db.run("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?", [
      salt,
      hash,
      id,
    ]);
  }

  async listRoles(): Promise<RoleRow[]> {
    return this.db.all<RoleRow>("SELECT id, name, description FROM roles ORDER BY name");
  }
}
