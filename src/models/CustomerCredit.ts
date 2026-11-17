export interface CustomerCredit {
  customerId: string;
  totalCredit: number; // total amount lent
  outstanding: number; // amount still due
  creditLimit: number; // max credit allowed
  lastPaymentDate?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  billId?: string;
  type: 'debit' | 'credit'; // debit = amount lent, credit = payment received
  amount: number;
  balance: number; // remaining balance after this transaction
  notes?: string;
  timestamp: number;
}