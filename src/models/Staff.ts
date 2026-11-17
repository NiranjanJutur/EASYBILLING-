export type StaffRole = 'OWNER' | 'CASHIER' | 'STOCK_MANAGER' | 'ACCOUNTANT';

/** The person currently logged in on this device. */
export interface StaffSession {
  id: string;
  name: string;
  role: StaffRole;
  storeId: string;
  loginAt: number;
  /** True only for the developer shortcut in debug builds. */
  dev?: boolean;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: 'Owner',
  CASHIER: 'Cashier',
  STOCK_MANAGER: 'Stock Manager',
  ACCOUNTANT: 'Accountant',
};

/** Roles that may record purchases and pay suppliers. */
export const PURCHASE_ROLES: StaffRole[] = ['OWNER', 'STOCK_MANAGER'];
