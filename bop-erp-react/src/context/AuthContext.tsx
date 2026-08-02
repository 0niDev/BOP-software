// Authentication Context for React
// DEBUG: Manages user authentication state and permissions

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../models';
import { UserRole, PermissionCode } from '../enums';
import { debugLog, errorLog } from '../config';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: PermissionCode) => boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionCode[]>([]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      debugLog('AuthProvider', 'Checking for existing session');
      
      try {
        const savedUser = localStorage.getItem('erp_user');
        const savedPermissions = localStorage.getItem('erp_permissions');
        
        if (savedUser && savedPermissions) {
          const parsedUser = JSON.parse(savedUser);
          const parsedPermissions = JSON.parse(savedPermissions);
          
          setUser(parsedUser);
          setPermissions(parsedPermissions);
          debugLog('AuthProvider', 'Restored session for user:', parsedUser.username);
        }
      } catch (error) {
        errorLog('AuthProvider', 'Failed to restore session', error);
        localStorage.removeItem('erp_user');
        localStorage.removeItem('erp_permissions');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  /**
   * Login with username and password
   * DEBUG: Validates credentials and fetches user permissions
   */
  const login = async (username: string, password: string) => {
    debugLog('AuthProvider', `Login attempt for user: ${username}`);
    
    try {
      // Import AuthService dynamically to avoid circular dependencies
      const { AuthService } = await import('../services/auth-service');
      const authService = new AuthService();
      
      const loggedInUser = await authService.authenticate(username, password);
      
      // Fetch permissions
      const userPermissions = await authService.getUserPermissions(loggedInUser.id);
      
      setUser(loggedInUser);
      setPermissions(userPermissions);
      
      // Persist session
      localStorage.setItem('erp_user', JSON.stringify(loggedInUser));
      localStorage.setItem('erp_permissions', JSON.stringify(userPermissions));
      
      debugLog('AuthProvider', `Login successful for: ${username}`, {
        userId: loggedInUser.id,
        roleId: loggedInUser.role_id,
        permissionsCount: userPermissions.length,
      });
    } catch (error) {
      errorLog('AuthProvider', 'Login failed', error);
      throw error;
    }
  };

  /**
   * Logout and clear session
   */
  const logout = () => {
    debugLog('AuthProvider', 'Logging out user');
    
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_permissions');
    
    debugLog('AuthProvider', 'Logout complete');
  };

  /**
   * Check if user has specific permission
   */
  const hasPermission = (permission: PermissionCode): boolean => {
    return permissions.includes(permission);
  };

  /**
   * Check if user has specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return user?.role_id === getRoleIdFromEnum(role);
  };

  // Helper to get role ID from enum (would normally come from database)
  const getRoleIdFromEnum = (role: UserRole): number => {
    const roleMap: Record<UserRole, number> = {
      [UserRole.ADMIN]: 1,
      [UserRole.MANAGER]: 2,
      [UserRole.ACCOUNTANT]: 3,
      [UserRole.SALES]: 4,
      [UserRole.WAREHOUSE]: 5,
      [UserRole.OPERATOR]: 6,
    };
    return roleMap[role] || 0;
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

console.log('[AuthContext] Authentication context created');
