export interface Product {
    id: string;                          // UUID from Supabase
    name: string;
    category: string;
    imageUrl: string;
    price: number;
    gstPercent: 0 | 5 | 12 | 18 | 28;
    currentStock: number;
    minThreshold: number;
    unit: string;
    packSize?: number;                   // e.g. 12 pcs/box, 25 kg/bag
    supplierId?: string | null;          // UUID FK → suppliers.id (nullable)
    supplierPhone: string;
    purchasePrice: number;
    competitorPriceNote?: string | null;
    isWeightBased: boolean;
    barcode?: string | null;
    sku?: string | null;
    hsnCode?: string | null;             // HSN code for GST compliance
    expiryDate?: string | null;          // ISO date string 'YYYY-MM-DD' (DB: DATE)
    isActive: boolean;
    createdAt?: string;                  // ISO timestamp (DB: TIMESTAMPTZ)
    updatedAt?: string;                  // ISO timestamp (DB: TIMESTAMPTZ)
}
