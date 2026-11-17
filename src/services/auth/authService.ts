import type { UserRole } from '../../models/Role';
import { ROLE_PERMISSIONS } from '../../models/Role';

export interface AuthContext {
  userId: string;
  role: UserRole;
  storeId: string;
}

let currentAuthContext: AuthContext | null = null;

export const authService = {
  // Set current user auth context
  setAuthContext(context: AuthContext) {
    currentAuthContext = context;
  },

  // Get current auth context
  getAuthContext(): AuthContext | null {
    return currentAuthContext;
  },

  // Check if user has permission
  hasPermission(action: string, resource: string): boolean {
    if (!currentAuthContext) return false;
    const permissions = ROLE_PERMISSIONS[currentAuthContext.role] || [];
    return permissions.some(p => p.action === action && p.resource === resource);
  },

  // Check if user has any of the specified roles
  hasRole(...roles: UserRole[]): boolean {
    if (!currentAuthContext) return false;
    return roles.includes(currentAuthContext.role);
  },

  // Guard function for screens - throws error if no permission
  requirePermission(action: string, resource: string): void {
    if (!this.hasPermission(action, resource)) {
      throw new Error(
        `Unauthorized: ${currentAuthContext?.role} cannot ${action} ${resource}`
      );
    }
  },

  // Guard function for roles
  requireRole(...roles: UserRole[]): void {
    if (!this.hasRole(...roles)) {
      throw new Error(
        `Unauthorized: only ${roles.join(', ')} can access this resource`
      );
    }
  },

  // Clear auth context (logout)
  logout(): void {
    currentAuthContext = null;
  },
};

// React Hook for auth
export function useAuth() {
  const context = authService.getAuthContext();
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return {
    ...context,
    hasPermission: (action: string, resource: string) =>
      authService.hasPermission(action, resource),
    hasRole: (...roles: UserRole[]) => authService.hasRole(...roles),
  };
}

