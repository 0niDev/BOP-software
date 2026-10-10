/**
 * Authentication. PBKDF2-HMAC-SHA256, 200,000 iterations, 16-byte salt,
 * hex-encoded salt + hash -- byte-for-byte compatible with the Python app's
 * utils/security.py, so existing users can log in unchanged.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import type { SqlDatabase } from "../db/types.js";
import { UnauthorizedError, ValidationError } from "../domain/errors.js";
import { UserRepository } from "../repositories/userRepository.js";

const ITERATIONS = 200_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const SALT_BYTES = 16;

export function hashPassword(plain: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(SALT_BYTES);
  const hash = pbkdf2Sync(plain, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export function verifyPassword(plain: string, saltHex: string, expectedHashHex: string): boolean {
  const { hash } = hashPassword(plain, saltHex);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(expectedHashHex, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  roleName: string | null;
}

export class AuthService {
  private readonly users: UserRepository;

  constructor(db: SqlDatabase) {
    this.users = new UserRepository(db);
  }

  async login(username: string, password: string): Promise<AuthenticatedUser> {
    const name = username.trim();
    const row = await this.users.findByUsername(name);
    if (!row || !row.is_active) {
      throw new UnauthorizedError("Invalid username or password.");
    }
    if (!verifyPassword(password, row.password_salt, row.password_hash)) {
      throw new UnauthorizedError("Invalid username or password.");
    }
    await this.users.updateLastLogin(row.id, new Date().toISOString());
    const withRole = await this.users.findWithRoleById(row.id);
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      roleName: withRole?.role_name ?? null,
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new ValidationError("New password must be at least 6 characters.");
    }
    const row = await this.users.findWithRoleById(userId);
    if (!row) throw new UnauthorizedError("User not found.");
    if (!verifyPassword(oldPassword, row.password_salt, row.password_hash)) {
      throw new UnauthorizedError("Current password is incorrect.");
    }
    const { salt, hash } = hashPassword(newPassword);
    await this.users.updatePassword(userId, salt, hash);
  }
}
