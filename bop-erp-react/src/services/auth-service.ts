// Authentication Service - User login and permissions
// DEBUG: Implements PBKDF2-HMAC-SHA256 password verification

import { dbConnection } from '../utils/database';
import { User, Permission } from '../models';
import { debugLog, errorLog, APP_SETTINGS } from '../config';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`User ${username} not found`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Authentication Service
 * DEBUG: Handles user authentication and permission fetching
 */
export class AuthService {
  /**
   * Authenticate user with username and password
   * DEBUG: Uses PBKDF2-HMAC-SHA256 with 200k iterations
   */
  async authenticate(username: string, password: string): Promise<User> {
    debugLog('AuthService', `Authenticating user: ${username}`);

    try {
      // Fetch user by username
      const users = await dbConnection.query<any>(
        `SELECT * FROM users WHERE username = ? AND is_active = 1`,
        [username]
      );

      if (users.length === 0) {
        debugLog('AuthService', `User not found: ${username}`);
        throw new InvalidCredentialsError();
      }

      const userRow = users[0];
      debugLog('AuthService', `User found, verifying password for: ${userRow.username}`);

      // Verify password hash
      const isValid = await this.verifyPassword(password, userRow.password_hash, userRow.salt);

      if (!isValid) {
        debugLog('AuthService', `Password verification failed for: ${username}`);
        throw new InvalidCredentialsError();
      }

      // Update last login
      await dbConnection.query(
        `UPDATE users SET last_login = ? WHERE id = ?`,
        [new Date().toISOString(), userRow.id]
      );

      const user: User = {
        id: userRow.id,
        username: userRow.username,
        password_hash: userRow.password_hash,
        full_name: userRow.full_name,
        email: userRow.email,
        phone: userRow.phone,
        role_id: userRow.role_id,
        company_id: userRow.company_id,
        is_active: userRow.is_active,
        last_login: new Date().toISOString(),
        created_at: userRow.created_at,
        updated_at: userRow.updated_at,
      };

      debugLog('AuthService', `Authentication successful for: ${username}`);
      return user;
    } catch (error) {
      if (error instanceof InvalidCredentialsError || error instanceof UserNotFoundError) {
        throw error;
      }
      errorLog('AuthService', 'Authentication error', error);
      throw error;
    }
  }

  /**
   * Verify password using PBKDF2-HMAC-SHA256
   * DEBUG: Web Crypto API implementation
   */
  private async verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
    try {
      // Encode password and salt
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(password);
      const saltData = encoder.encode(salt);

      // Import key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordData,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      // Derive key with same parameters as storage
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: saltData,
          iterations: APP_SETTINGS.PASSWORD_HASH_ITERATIONS,
        },
        keyMaterial,
        256
      );

      // Convert to hex string for comparison
      const derivedHash = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      debugLog('AuthService', `Password hash derived, comparing...`);
      
      // Compare hashes
      return derivedHash === storedHash;
    } catch (error) {
      errorLog('AuthService', 'Password verification error', error);
      return false;
    }
  }

  /**
   * Get user permissions by user ID
   * DEBUG: Fetches all permissions through role
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    debugLog('AuthService', `Fetching permissions for user: ${userId}`);

    try {
      // Get user's role
      const users = await dbConnection.query<any>(
        `SELECT role_id FROM users WHERE id = ?`,
        [userId]
      );

      if (users.length === 0) {
        throw new UserNotFoundError(`User with id ${userId}`);
      }

      const roleId = users[0].role_id;

      // Fetch permissions through role_permissions join
      const permissions = await dbConnection.query<any>(
        `SELECT p.code 
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [roleId]
      );

      const permissionCodes = permissions.map(p => p.code);
      debugLog('AuthService', `Found ${permissionCodes.length} permissions for user ${userId}`);

      return permissionCodes;
    } catch (error) {
      errorLog('AuthService', 'Failed to fetch permissions', error);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permissionCode);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<User | null> {
    debugLog('AuthService', `Fetching user by id: ${userId}`);

    try {
      const users = await dbConnection.query<any>(
        `SELECT * FROM users WHERE id = ?`,
        [userId]
      );

      if (users.length === 0) {
        return null;
      }

      const userRow = users[0];
      return {
        id: userRow.id,
        username: userRow.username,
        password_hash: userRow.password_hash,
        full_name: userRow.full_name,
        email: userRow.email,
        phone: userRow.phone,
        role_id: userRow.role_id,
        company_id: userRow.company_id,
        is_active: userRow.is_active,
        last_login: userRow.last_login,
        created_at: userRow.created_at,
        updated_at: userRow.updated_at,
      };
    } catch (error) {
      errorLog('AuthService', 'Failed to fetch user', error);
      return null;
    }
  }
}

console.log('[AuthService] Authentication service initialized');
console.log('[AuthService] Password hashing: PBKDF2-HMAC-SHA256,', APP_SETTINGS.PASSWORD_HASH_ITERATIONS, 'iterations');
