export type CustomerType =
    | 'house'
    | 'small_shop'
    | 'hotel'
    | 'function'
    | 'wholesale'
    | 'vip';

export interface Customer {
    id: string;                          // UUID from Supabase
    udhaarId?: string | null;            // unique text identifier (optional)
    gstNumber?: string | null;           // GSTIN for wholesale customers
    name: string;
    phone: string;
    houseNo?: string | null;
    type: CustomerType;
    creditLimit: number;
    totalOutstanding: number;            // managed atomically via RPC
    whatsappNumber: string;
    firstPurchaseDate?: string | null;   // ISO date 'YYYY-MM-DD'
    slipImages: string[];
    notes?: string | null;
    photoUrl?: string | null;
    isActive: boolean;
    createdAt?: string;                  // ISO timestamp
    updatedAt?: string;                  // ISO timestamp
}
