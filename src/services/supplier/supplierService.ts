import type { SupplierInput, Purchase } from '../../models/Supplier';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const supplierService = {
  /** Checks a supplier form. Returns a list of problems (empty = OK). */
  validateSupplier(s: Partial<SupplierInput>): string[] {
    const errors: string[] = [];
    if (!s.name || s.name.trim().length < 2) errors.push('Enter the supplier name');

    const digits = (s.phone ?? '').replace(/\D/g, '');
    if (digits.length > 0 && digits.length !== 10 && !(digits.length === 12 && digits.startsWith('91'))) {
      errors.push('Phone number should have 10 digits');
    }

    const gst = (s.gstNumber ?? '').trim().toUpperCase();
    if (gst && !GSTIN_PATTERN.test(gst)) errors.push('GST number should look like 29ABCDE1234F1Z5');

    if (s.paymentTerms === 'credit' && (!s.creditDays || s.creditDays < 0 || s.creditDays > 365)) {
      errors.push('Credit days should be between 1 and 365');
    }
    if (s.openingDue !== undefined && (isNaN(s.openingDue) || s.openingDue < 0)) {
      errors.push('Opening due cannot be negative');
    }
    return errors;
  },

  /** Balance still unpaid on a purchase. */
  balance(p: Pick<Purchase, 'grandTotal' | 'amountPaid'>): number {
    return Math.max(0, Math.round((p.grandTotal - p.amountPaid) * 100) / 100);
  },

  /** Days left until a credit purchase is due (negative = overdue). Null for cash suppliers. */
  daysUntilDue(p: Pick<Purchase, 'invoiceDate'>, creditDays: number): number | null {
    if (!creditDays) return null;
    const due = new Date(`${p.invoiceDate}T00:00:00`);
    due.setDate(due.getDate() + creditDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  },
};

/** Named re-export so screens can `import { validateSupplier }` */
export function validateSupplier(s: Partial<SupplierInput>): string[] {
  return supplierService.validateSupplier(s);
}
