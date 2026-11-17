export interface SlipItem {
    name: string;
    qty: number;
    unit?: string;       // e.g. 'kg', 'pcs', 'packet'
    amount?: number;     // Left-column line total as read from slip (exact, not recalculated)
    confidence?: number; // 0.0 – 1.0
}

export interface SlipOCRResult {
    name?: string;
    houseNo?: string;
    phone?: string;
    date?: string;
    items: SlipItem[];
    totalItems?: number;
    grandTotal?: number;
    language?: string;
}

export interface Slip {
    id: string;
    imageUrl: string;
    ocrResult: SlipOCRResult;
    writtenByUserId: string;
    writtenByName: string;
    customerId?: string;
    timestamp: string;
    billId?: string;
}
