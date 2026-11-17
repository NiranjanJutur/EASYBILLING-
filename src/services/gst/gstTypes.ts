/**
 * gstTypes.ts — TypeScript interfaces for Masters India GSP API.
 *
 * Covers:
 *   - Auth (token request / response)
 *   - e-Invoice (IRN generation request / response)
 *   - e-Way Bill (EWB generation request / response)
 *   - Combined IRN + EWB response
 *
 * Schema reference:
 *   https://einvoice1.gst.gov.in/Others/SandboxDoc
 *   https://www.mastergst.com/einvoice-api
 */

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface GspAuthRequest {
  username: string;   // GSP portal username
  password: string;   // GSP portal password
  gstin: string;      // Taxpayer GSTIN (15-char)
  app_key: string;    // AES-256 key (base64) generated client-side
}

export interface GspAuthResponse {
  status: '1' | '0';  // '1' = success
  data: {
    AuthToken: string;          // Bearer token (valid ~6 hrs)
    Expiry: string;             // ISO datetime
    SessionId: string;
  };
  error?: string;
}

// ── e-Invoice: Request ────────────────────────────────────────────────────────

export type SupplyType = 'B2B' | 'B2C' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEXP';
export type DocType = 'INV' | 'CRN' | 'DBN';
export type GstRate = 0 | 5 | 12 | 18 | 28;

export interface EInvoiceItem {
  SlNo: string;           // '1', '2', '3' ...
  PrdDesc: string;        // Product description
  IsServc: 'Y' | 'N';
  HsnCd: string;          // 4–8 digit HSN / SAC code
  Qty: number;
  Unit: string;           // UQC code e.g. 'KGS', 'NOS', 'PCS'
  UnitPrice: number;      // per unit price (excl. GST)
  TotAmt: number;         // Qty × UnitPrice
  AssAmt: number;         // Taxable value (after discount)
  GstRt: GstRate;
  IgstAmt: number;
  CgstAmt: number;
  SgstAmt: number;
  CesRt?: number;
  CesAmt?: number;
  TotItemVal: number;     // AssAmt + all tax amounts
  Discount?: number;
}

export interface EInvoiceAddress {
  Gstin?: string;
  LglNm: string;          // Legal name
  TrdNm?: string;         // Trade name
  Addr1: string;
  Addr2?: string;
  Loc: string;            // City / locality
  Pin: number;            // 6-digit pincode
  Stcd: string;           // State code (e.g. '29' for Karnataka)
  Ph?: string;
  Em?: string;
}

export interface EInvoiceRequest {
  Version: '1.1';
  TranDtls: {
    TaxSch: 'GST';
    SupTyp: SupplyType;
    RegRev?: 'Y' | 'N';  // Reverse charge
    IgstOnIntra?: 'Y' | 'N';
  };
  DocDtls: {
    Typ: DocType;
    No: string;           // Invoice number (max 16 chars)
    Dt: string;           // 'DD/MM/YYYY'
  };
  SellerDtls: EInvoiceAddress;
  BuyerDtls: EInvoiceAddress & { Pos: string }; // Place of supply state code
  ItemList: EInvoiceItem[];
  ValDtls: {
    AssVal: number;       // Total taxable value
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    CesVal?: number;
    Discount?: number;
    OthChrg?: number;
    TotInvVal: number;    // Grand total
  };
}

// ── e-Invoice: Response ───────────────────────────────────────────────────────

export interface EInvoiceResponse {
  status: '1' | '0';
  data?: {
    Irn: string;          // 64-char Invoice Reference Number
    AckNo: string;        // Acknowledgement number
    AckDt: string;        // Acknowledgement date
    SignedInvoice: string;// JWT signed invoice
    SignedQRCode: string; // QR code data (JWT)
    QRCodeUrl?: string;   // Rendered QR image URL (GSP-specific)
    Status: 'ACT' | 'CNL';
    EwbNo?: string;       // Set if combined IRN+EWB call used
    EwbDt?: string;
    EwbValidTill?: string;
  };
  error?: string;
  errorCodes?: string[];
}

// ── e-Way Bill: Request ───────────────────────────────────────────────────────

export type TransportMode = '1' | '2' | '3' | '4'; // 1=Road 2=Rail 3=Air 4=Ship
export type SubSupplyType =
  | '1'  // Supply
  | '2'  // Import
  | '3'  // Export
  | '4'  // Job Work
  | '5'  // For Own Use
  | '6'  // Job Work Returns
  | '7'  // Sales Return
  | '8'  // Others;

export interface EWayBillItem {
  productName: string;
  productDesc: string;
  hsnCode: string;
  quantity: number;
  qtyUnit: string;
  taxableAmount: number;
  cgstRate: GstRate | 0;
  sgstRate: GstRate | 0;
  igstRate: GstRate | 0;
  cessRate?: number;
}

export interface EWayBillRequest {
  supplyType: 'O' | 'I';   // O = Outward, I = Inward
  subSupplyType: SubSupplyType;
  docType: DocType;
  docNo: string;
  docDate: string;          // 'DD/MM/YYYY'
  fromGstin: string;        // Seller GSTIN
  fromTrdName: string;
  fromAddr1: string;
  fromAddr2?: string;
  fromPlace: string;
  fromPincode: number;
  fromStateCode: number;    // e.g. 29
  toGstin: string;          // Buyer GSTIN (or 'URP' for unregistered)
  toTrdName: string;
  toAddr1: string;
  toAddr2?: string;
  toPlace: string;
  toPincode: number;
  toStateCode: number;
  totalValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  cessValue?: number;
  transporterId?: string;
  transporterName?: string;
  transDocNo?: string;
  transMode: TransportMode;
  transDistance: number;    // in km
  vehicleNo?: string;       // e.g. 'KA01AB1234'
  vehicleType?: 'R' | 'O'; // R = Regular, O = ODC
  itemList: EWayBillItem[];
}

// ── e-Way Bill: Response ──────────────────────────────────────────────────────

export interface EWayBillResponse {
  status: '1' | '0';
  data?: {
    ewayBillNo: string;       // 12-digit EWB number
    ewayBillDate: string;     // 'YYYY-MM-DD HH:mm:ss'
    validUpto: string;        // 'YYYY-MM-DD HH:mm:ss'
    alert?: string;           // Non-fatal warnings from NIC
  };
  error?: string;
  errorCodes?: string[];
}

// ── Stored GST record (persisted on Transaction) ──────────────────────────────

export interface GstComplianceRecord {
  irn: string;
  ackNo: string;
  ackDt: string;
  signedQRCode: string;
  ewayBillNo?: string;
  ewayBillValidUpto?: string;
  generatedAt: string;  // ISO timestamp
}

// ── GSTIN Search: Response ───────────────────────────────────────────────────

// Official Government Search Taxpayer API (v1.3 commonapi) Result
export interface GSTSearchResponse {
    lgnm: string;           // Legal Name
    tradeNam: string;       // Trade Name
    gstin: string;
    dty: string;            // Taxpayer type (Regular, Composition etc.)
    sts: string;            // Status (Active, Provisonal, Suspended)
    rgdt: string;           // Registration Date
    ctb: string;            // Constitution of business
    pradr: {                // Principal Place of Business Address
        addr: {
            bnm?: string;   // Building Name
            st?: string;    // Street
            loc?: string;   // Location
            bno?: string;   // Building Number
            stcd: string;   // State (text)
            flno?: string;  // Floor Number
            pncd: string;   // Pincode
        },
        ntr: string[];      // Nature of business
    };
  error?: string;
}
