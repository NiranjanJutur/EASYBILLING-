export type PaymentMethod = 'cash' | 'upi' | 'card' | 'check' | 'credit';

export interface Payment {
  id: string;
  billId: string;
  method: PaymentMethod;
  amount: number;
  timestamp: number;
  reference?: string; // UPI ref, check number, card last 4 digits
  status: 'completed' | 'pending' | 'failed';
}

export interface PaymentConfig {
  methods: PaymentMethod[];
  defaultMethod: PaymentMethod;
  gst: number; // GST percentage
  currency: string; // INR
}