import type { CustomerCredit, CreditTransaction } from '../../models/CustomerCredit';

export const customerCreditService = {
  /**
   * Initialize credit record for new customer
   */
  initializeCredit(
    customerId: string,
    creditLimit: number = 0
  ): CustomerCredit {
    return {
      customerId,
      totalCredit: 0,
      outstanding: 0,
      creditLimit,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },

  /**
   * Add credit to customer (when giving goods on credit)
   */
  addCredit(
    credit: CustomerCredit,
    amount: number,
    billId: string
  ): {
    updated: CustomerCredit;
    transaction: CreditTransaction;
  } {
    const updated = {
      ...credit,
      totalCredit: credit.totalCredit + amount,
      outstanding: credit.outstanding + amount,
      updatedAt: Date.now(),
    };

    const transaction: CreditTransaction = {
      id: `CT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId: credit.customerId,
      billId,
      type: 'debit',
      amount,
      balance: updated.outstanding,
      timestamp: Date.now(),
    };

    return { updated, transaction };
  },

  /**
   * Record credit payment
   */
  recordPayment(
    credit: CustomerCredit,
    amount: number,
    notes?: string
  ): {
    updated: CustomerCredit;
    transaction: CreditTransaction;
  } {
    const paymentAmount = Math.min(amount, credit.outstanding);
    const updated = {
      ...credit,
      outstanding: credit.outstanding - paymentAmount,
      lastPaymentDate: Date.now(),
      updatedAt: Date.now(),
    };

    const transaction: CreditTransaction = {
      id: `CT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId: credit.customerId,
      type: 'credit',
      amount: paymentAmount,
      balance: updated.outstanding,
      notes,
      timestamp: Date.now(),
    };

    return { updated, transaction };
  },

  /**
   * Check if customer can get more credit
   */
  canGiveCredit(credit: CustomerCredit, amount: number): boolean {
    const wouldBeOutstanding = credit.outstanding + amount;
    return wouldBeOutstanding <= credit.creditLimit;
  },

  /**
   * Calculate remaining credit available
   */
  availableCredit(credit: CustomerCredit): number {
    return credit.creditLimit - credit.outstanding;
  },

  /**
   * Get credit status
   */
  getCreditStatus(
    credit: CustomerCredit
  ): 'good' | 'warning' | 'overdue' | 'no-credit' {
    if (credit.creditLimit === 0) return 'no-credit';
    if (credit.outstanding === 0) return 'good';

    const utilizationPercent = (credit.outstanding / credit.creditLimit) * 100;

    if (utilizationPercent >= 100) return 'overdue';
    if (utilizationPercent >= 80) return 'warning';
    return 'good';
  },

  /**
   * Validate credit limit update
   */
  validateCreditLimit(newLimit: number): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (newLimit < 0) {
      errors.push('Credit limit cannot be negative');
    }

    if (newLimit > 1000000) {
      errors.push('Credit limit exceeds maximum allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Format credit amount for display
   */
  formatAmount(amount: number): string {
    return `₹${amount.toFixed(2)}`;
  },

  /**
   * Get days since last payment
   */
  daysSinceLastPayment(credit: CustomerCredit): number | null {
    if (!credit.lastPaymentDate) return null;
    const daysMs = Date.now() - credit.lastPaymentDate;
    return Math.floor(daysMs / (1000 * 60 * 60 * 24));
  },
};

