/**
 * User administration, ported from authentication/auth_service.py
 * (list_users / create_user / update_user / reset_password).
 */
import type { SqlDatabase } from "../db/types.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import {
  UserRepository,
  type NewUser,
  type RoleRow,
  type UserSummaryRow,
  type UserUpdate,
} from "../repositories/userRepository.js";
import { hashPassword } from "./authService.js";

const MIN_PASSWORD_LENGTH = 6;

export interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  roleName: string;
  email?: string | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName: string;
  email?: string | null;
  roleName: string;
  isActive: boolean;
  password?: string | null;
}

export class UserService {
  private readonly users: UserRepository;

  constructor(db: SqlDatabase) {
    this.users = new UserRepository(db);
  }

  async list(): Promise<UserSummaryRow[]> {
    return this.users.listWithRoles();
  }

  async get(id: number): Promise<UserSummaryRow> {
    const row = await this.users.findSummaryById(id);
    if (!row) throw new NotFoundError("User not found.");
    return row;
  }

  async create(input: CreateUserInput): Promise<UserSummaryRow> {
    const username = input.username.trim();
    if (!username) throw new ValidationError("Username is required.");
    if (!input.password) throw new ValidationError("Password is required.");
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (await this.users.findByUsername(username)) {
      throw new ConflictError(`Username '${username}' already exists.`);
    }
    const role = await this.users.findRoleByName(input.roleName);
    if (!role) throw new ValidationError(`Role '${input.roleName}' not found.`);

    const { salt, hash } = hashPassword(input.password);
    const data: NewUser = {
      username,
      full_name: input.fullName.trim(),
      email: input.email?.trim() || null,
      password_hash: hash,
      password_salt: salt,
      role_id: Number(role.id),
      is_active: input.isActive === false ? 0 : 1,
    };
    const id = await this.users.create(data);
    return (await this.users.findSummaryById(id)) as UserSummaryRow;
  }

  async update(id: number, input: UpdateUserInput): Promise<UserSummaryRow> {
    const existing = await this.users.findSummaryById(id);
    if (!existing) throw new NotFoundError("User not found.");

    const role = await this.users.findRoleByName(input.roleName);
    if (!role) throw new ValidationError(`Role '${input.roleName}' not found.`);

    const data: UserUpdate = {
      full_name: input.fullName.trim(),
      email: input.email?.trim() || null,
      role_id: Number(role.id),
      is_active: input.isActive ? 1 : 0,
    };

    const password = input.password?.trim();
    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      const { salt, hash } = hashPassword(password);
      data.password_hash = hash;
      data.password_salt = salt;
    }

    await this.users.update(id, data);
    return (await this.users.findSummaryById(id)) as UserSummaryRow;
  }

  /** Admin password reset: sets a new password without knowing the old one. */
  async resetPassword(id: number, newPassword: string): Promise<void> {
    if (!newPassword) throw new ValidationError("Password is required.");
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    const existing = await this.users.findSummaryById(id);
    if (!existing) throw new NotFoundError("User not found.");
    const { salt, hash } = hashPassword(newPassword);
    await this.users.update(id, { password_hash: hash, password_salt: salt });
  }

  /** Role catalogue for the create/edit form. */
  async roles(): Promise<RoleRow[]> {
    return this.users.listRoles();
  }
}
