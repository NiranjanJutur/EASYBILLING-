export type UserRole = 'owner' | 'cashier' | 'stock_manager' | 'accountant';

export interface Permission {
  action: string; // 'create', 'read', 'update', 'delete'
  resource: string; // 'products', 'bills', 'customers', 'reports', 'settings'
  scope?: 'own' | 'department' | 'all';
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    { action: 'create', resource: 'products', scope: 'all' },
    { action: 'read', resource: 'products', scope: 'all' },
    { action: 'update', resource: 'products', scope: 'all' },
    { action: 'delete', resource: 'products', scope: 'all' },
    { action: 'create', resource: 'bills', scope: 'all' },
    { action: 'read', resource: 'bills', scope: 'all' },
    { action: 'update', resource: 'bills', scope: 'all' },
    { action: 'delete', resource: 'bills', scope: 'all' },
    { action: 'read', resource: 'customers', scope: 'all' },
    { action: 'update', resource: 'customers', scope: 'all' },
    { action: 'read', resource: 'reports', scope: 'all' },
    { action: 'read', resource: 'settings', scope: 'all' },
    { action: 'update', resource: 'settings', scope: 'all' },
  ],
  cashier: [
    { action: 'read', resource: 'products', scope: 'all' },
    { action: 'create', resource: 'bills', scope: 'all' },
    { action: 'read', resource: 'bills', scope: 'own' },
    { action: 'read', resource: 'customers', scope: 'all' },
  ],
  stock_manager: [
    { action: 'read', resource: 'products', scope: 'all' },
    { action: 'update', resource: 'products', scope: 'all' },
    { action: 'read', resource: 'bills', scope: 'all' },
    { action: 'read', resource: 'customers', scope: 'all' },
  ],
  accountant: [
    { action: 'read', resource: 'products', scope: 'all' },
    { action: 'read', resource: 'bills', scope: 'all' },
    { action: 'read', resource: 'customers', scope: 'all' },
    { action: 'read', resource: 'reports', scope: 'all' },
  ],
};

export function canPerform(role: UserRole, action: string, resource: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some(p => p.action === action && p.resource === resource);
}