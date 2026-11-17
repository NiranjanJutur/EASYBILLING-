export type PaymentType = 'CASH' | 'UPI' | 'CARD' | 'UDHAAR' | 'SPLIT';
export type OrderType = 'in_store' | 'takeaway' | 'delivery' | 'wholesale';

export interface TransactionItem {
  productId: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  gst: number;       // GST rate applied (0 | 5 | 12 | 18 | 28)
  gstAmount: number; // computed: (price * qty * gst) / 100
  total: number;     // price * qty + gstAmount
}

export interface Transaction {
  id: string;
  billNo: string;
  items: TransactionItem[];
  subtotal: number;
  totalGST: number;
  grandTotal: number;
  paymentType: PaymentType;
  paymentSplit?: { cash: number; upi: number; card: number; udhaar: number };
  customerId?: string;
  customerName?: string;
  customerGstNumber?: string | null;
  cashierId: string;
  cashierName?: string;
  orderType?: OrderType;
  deliveryAddress?: string;
  billPdfUrl?: string;
  timestamp: string; // ISO string — stored as TIMESTAMPTZ in DB
  isReturn: boolean;
  discountAmount?: number;
  irn?: string | null;
  ewayBillNo?: string | null;
}
