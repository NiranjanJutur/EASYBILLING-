import type { Payment, PaymentMethod } from '../../models/Payment';

export interface PaymentValidation {
  isValid: boolean;
  errors: string[];
}

export const paymentService = {
  /**
   * Validate payment amount and method
   */
  validatePayment(
    method: PaymentMethod,
    amount: number,
    totalAmount: number
  ): PaymentValidation {
    const errors: string[] = [];

    if (amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (amount > totalAmount) {
      errors.push('Payment amount exceeds bill total');
    }

    // Method-specific validation
    switch (method) {
      case 'upi':
        if (amount < 1) errors.push('UPI minimum amount is ₹1');
        break;
      case 'card':
        if (amount < 100) errors.push('Card minimum amount is ₹100');
        break;
      case 'check':
        if (amount < 500) errors.push('Check minimum amount is ₹500');
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Create payment record
   */
  createPayment(
    billId: string,
    method: PaymentMethod,
    amount: number,
    reference?: string
  ): Payment {
    return {
      id: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      billId,
      method,
      amount,
      timestamp: Date.now(),
      reference,
      status: method === 'credit' ? 'pending' : 'completed',
    };
  },

  /**
   * Calculate remaining balance
   */
  calculateBalance(totalAmount: number, payments: Payment[]): number {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return totalAmount - totalPaid;
  },

  /**
   * Get payment status color for UI
   */
  getPaymentStatusColor(method: PaymentMethod): string {
    const colors: Record<PaymentMethod, string> = {
      cash: '#10B981', // green
      upi: '#3B82F6', // blue
      card: '#8B5CF6', // purple
      check: '#F59E0B', // amber
      credit: '#EF4444', // red
    };
    return colors[method];
  },

  /**
   * Format payment method for display
   */
  formatPaymentMethod(method: PaymentMethod): string {
    const names: Record<PaymentMethod, string> = {
      cash: 'Cash',
      upi: 'UPI',
      card: 'Card',
      check: 'Cheque',
      credit: 'Udhaar (Credit)',
    };
    return names[method];
  },

  /**
   * Get available payment methods based on configuration
   */
  getAvailableMethods(enabledMethods: PaymentMethod[]): PaymentMethod[] {
    return enabledMethods;
  },

  /**
   * Validate split payment (multiple payment methods)
   */
  validateSplitPayment(
    payments: Array<{ method: PaymentMethod; amount: number }>,
    totalAmount: number
  ): PaymentValidation {
    const errors: string[] = [];
    let totalPaid = 0;

    for (const payment of payments) {
      const validation = this.validatePayment(
        payment.method,
        payment.amount,
        totalAmount
      );
      if (!validation.isValid) {
        errors.push(...validation.errors);
      }
      totalPaid += payment.amount;
    }

    if (totalPaid !== totalAmount) {
      errors.push(
        `Total payment (₹${totalPaid}) doesn't match bill amount (₹${totalAmount})`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

