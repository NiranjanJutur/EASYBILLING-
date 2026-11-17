/**
 * eInvoiceService.ts — Masters India GSP e-Invoice (IRN) service.
 *
 * Responsibilities:
 *   1. Build the EInvoiceRequest payload from SMS cart/transaction data.
 *   2. Send it to the GSP /ei/api/invoice endpoint through the gsp-proxy
 *      Edge Function (which logs in and adds the portal credentials).
 *   3. Return a GstComplianceRecord with IRN + signed QR code.
 *
 * Usage:
 *   import { eInvoiceService } from '../gst/eInvoiceService';
 *
 *   const record = await eInvoiceService.generateIRN(transaction, sellerInfo);
 *   // store record.irn and record.signedQRCode on the Transaction row
 *
 * The GSP credentials are Supabase secrets, not app env vars.
 * See SUPABASE_SETUP.md → "GST portal".
 */

import type { Transaction, TransactionItem } from '../../models/Transaction';
import type {
  EInvoiceRequest,
  EInvoiceResponse,
  EInvoiceItem,
  GstComplianceRecord,
  GstRate,
  SupplyType,
  GSTSearchResponse,
} from './gstTypes';

// ── Seller info from shared env resolver ─────────────────────────────────────

import { SELLER_PLACE, SELLER_STATE_CODE } from './gstEnv';
import { gspRequest } from './gspProxy';

import { STORES } from '../../context/StoreContext';
import { getActiveStoreId } from '../activeStoreId';

function getActiveSeller() {
  const store = STORES.find(s => s.id === getActiveStoreId()) || STORES[0];
  return {
    gstin: store.gstin,
    name: store.name,
    addr1: store.address,
    place: SELLER_PLACE, // Fallback to env or can be extracted from address
    pincode: Number(store.pincode),
    stateCode: store.gstin.substring(0, 2) || SELLER_STATE_CODE, // State code is first 2 digits of GSTIN
  };
}

// ── UQC (Unit Quantity Code) mapping ─────────────────────────────────────────
// Maps SMS product units → GST UQC codes required by NIC

const UQC_MAP: Record<string, string> = {
  kg: 'KGS',  kgs: 'KGS', gram: 'GMS',  gm: 'GMS',  g: 'GMS',
  litre: 'LTR', ltr: 'LTR', l: 'LTR', ml: 'MLT',
  pcs: 'NOS', nos: 'NOS', piece: 'NOS', pieces: 'NOS', unit: 'NOS',
  box: 'BOX', pkt: 'PAC', pack: 'PAC', bag: 'BAG',
  mtr: 'MTR', m: 'MTR', cm: 'CMS',
};

function toUQC(unit: string): string {
  return UQC_MAP[unit.toLowerCase().trim()] ?? 'NOS';
}

class EInvoiceService {
  // GSP login and the auth token are handled by the gsp-proxy Edge Function.

  // ── Payload builder ───────────────────────────────────────────────────────

  /**
   * Converts a Transaction + customer GSTIN into a NIC-compliant EInvoiceRequest.
   *
   * Assumptions:
   *  - B2B if customerGstin is provided, otherwise B2C.
   *  - Same state → CGST + SGST split; different state → IGST.
   *  - Amounts already include GST in the Transaction (gstAmount per item).
   */
  public buildPayload(
    tx: Transaction,
    customerGstin?: string,
    customerName?: string,
    customerAddr1?: string,
    customerPlace?: string,
    customerPincode?: number,
    customerStateCode?: string,
  ): EInvoiceRequest {
    const seller = getActiveSeller();
    const isInterstate =
      customerStateCode !== undefined && customerStateCode !== seller.stateCode;

    const supplyType = customerGstin ? 'B2B' : 'B2C';

    // Format date as 'DD/MM/YYYY'
    const txDate = new Date(tx.timestamp);
    const docDate = [
      String(txDate.getDate()).padStart(2, '0'),
      String(txDate.getMonth() + 1).padStart(2, '0'),
      String(txDate.getFullYear()),
    ].join('/');

    // Build item list
    const itemList: EInvoiceItem[] = tx.items.map((item, idx) => {
      const gstRt = (item.gst ?? 0) as GstRate;
      const assAmt = Math.round((item.price * item.qty) * 100) / 100;
      const taxAmt = Math.round(item.gstAmount * 100) / 100;
      const cgstAmt = isInterstate ? 0 : Math.round((taxAmt / 2) * 100) / 100;
      const sgstAmt = isInterstate ? 0 : Math.round((taxAmt / 2) * 100) / 100;
      const igstAmt = isInterstate ? taxAmt : 0;

      return {
        SlNo: String(idx + 1),
        PrdDesc: item.name.slice(0, 100),
        IsServc: 'N',
        HsnCd: '0000',       // TODO: pull from Product.hsnCode when added to model
        Qty: item.qty,
        Unit: toUQC(item.unit),
        UnitPrice: item.price,
        TotAmt: assAmt,
        AssAmt: assAmt,
        GstRt: gstRt,
        IgstAmt: igstAmt,
        CgstAmt: cgstAmt,
        SgstAmt: sgstAmt,
        TotItemVal: Math.round((assAmt + taxAmt) * 100) / 100,
      };
    });

    const totalCgst = isInterstate ? 0 : Math.round((tx.totalGST / 2) * 100) / 100;
    const totalSgst = isInterstate ? 0 : Math.round((tx.totalGST / 2) * 100) / 100;
    const totalIgst = isInterstate ? tx.totalGST : 0;

    return {
      Version: '1.1',
      TranDtls: {
        TaxSch: 'GST',
        SupTyp: supplyType,
        RegRev: 'N',
        IgstOnIntra: 'N',
      },
      DocDtls: {
        Typ: 'INV',
        No: tx.billNo.slice(0, 16),
        Dt: docDate,
      },
      SellerDtls: {
        Gstin: seller.gstin,
        LglNm: seller.name,
        Addr1: seller.addr1,
        Loc: seller.place,
        Pin: seller.pincode,
        Stcd: seller.stateCode,
      },
      BuyerDtls: {
        Gstin: customerGstin ?? 'URP',
        LglNm: customerName ?? tx.customerName ?? 'Walk-in Customer',
        Addr1: customerAddr1 ?? 'NA',
        Loc: customerPlace ?? seller.place,
        Pin: customerPincode ?? seller.pincode,
        Stcd: customerStateCode ?? seller.stateCode,
        Pos: customerStateCode ?? seller.stateCode,
      },
      ItemList: itemList,
      ValDtls: {
        AssVal: tx.subtotal,
        CgstVal: totalCgst,
        SgstVal: totalSgst,
        IgstVal: totalIgst,
        TotInvVal: tx.grandTotal,
      },
    };
  }

  // ── Main: Generate IRN ────────────────────────────────────────────────────

  /**
   * Generates an IRN (Invoice Reference Number) for a completed transaction.
   *
   * @param tx               Completed Transaction from BillingManager
   * @param customerGstin    Buyer's GSTIN (omit for B2C / walk-in)
   * @param customerName     Buyer legal name
   * @param customerAddr1    Buyer address
   * @param customerPlace    Buyer city
   * @param customerPincode  Buyer pincode
   * @param customerStateCode Buyer GST state code (2-digit string)
   * @returns GstComplianceRecord to store on the Transaction
   */
  public async generateIRN(
    tx: Transaction,
    customerGstin?: string,
    customerName?: string,
    customerAddr1?: string,
    customerPlace?: string,
    customerPincode?: number,
    customerStateCode?: string,
  ): Promise<GstComplianceRecord> {
    const payload = this.buildPayload(
      tx,
      customerGstin,
      customerName,
      customerAddr1,
      customerPlace,
      customerPincode,
      customerStateCode,
    );

    console.log('[eInvoiceService] Generating IRN for bill:', tx.billNo);

    const res = await gspRequest({
      path: '/ei/api/invoice',
      gstin: getActiveSeller().gstin,
      body: payload,
    });

    if (!res.ok) {
      throw new Error(`[eInvoiceService] HTTP error: ${res.status}`);
    }

    const json: EInvoiceResponse = await res.json();

    if (json.status !== '1' || !json.data?.Irn) {
      const codes = json.errorCodes?.join(', ') ?? '';
      throw new Error(
        `[eInvoiceService] IRN generation failed: ${json.error ?? 'Unknown'} ${codes}`.trim(),
      );
    }

    const record: GstComplianceRecord = {
      irn: json.data.Irn,
      ackNo: json.data.AckNo,
      ackDt: json.data.AckDt,
      signedQRCode: json.data.SignedQRCode,
      generatedAt: new Date().toISOString(),
      ...(json.data.EwbNo && {
        ewayBillNo: json.data.EwbNo,
        ewayBillValidUpto: json.data.EwbValidTill,
      }),
    };

    console.log('[eInvoiceService] IRN generated:', record.irn);
    return record;
  }

  // ── Cancel IRN ────────────────────────────────────────────────────────────

  /**
   * Cancels an already-generated IRN.
   * Can only be cancelled within 24 hours of generation.
   *
   * @param irn    The 64-char IRN to cancel
   * @param reason Cancel reason code: 1=Duplicate, 2=Data Entry Mistake, 3=Order Cancelled, 4=Other
   * @param remark Optional free-text remark (max 100 chars)
   */
  public async cancelIRN(
    irn: string,
    reason: 1 | 2 | 3 | 4 = 4,
    remark?: string,
  ): Promise<void> {
    const res = await gspRequest({
      path: '/ei/api/invoice/cancel',
      gstin: getActiveSeller().gstin,
      body: {
        Irn: irn,
        CnlRsn: String(reason),
        CnlRem: remark?.slice(0, 100) ?? 'Cancelled',
      },
    });

    if (!res.ok) {
      throw new Error(`[eInvoiceService] Cancel HTTP error: ${res.status}`);
    }

    const json = await res.json();
    if (json.status !== '1') {
      throw new Error(`[eInvoiceService] Cancel failed: ${json.error ?? 'Unknown'}`);
    }

    console.log('[eInvoiceService] IRN cancelled:', irn);
  }

  // ── Search GSTIN ──────────────────────────────────────────────────────────

  /**
   * Fetches legal/trade name and address for a given GSTIN via MasterGST API.
   * "Find out easily" the firm name!
   */
  public async searchGSTIN(gstin: string): Promise<GSTSearchResponse> {
    try {
      // Official v1.3 commonapi search endpoint: /commonapi/v1.3/search?gstin={}&action=TP
      const res = await gspRequest({
        path: '/commonapi/v1.3/search',
        gstin: getActiveSeller().gstin,
        query: { gstin: gstin.trim().toUpperCase(), action: 'TP' },
        stateCode: SELLER_STATE_CODE,
      });

      if (!res.ok) {
        throw new Error(`GST Search API error: ${res.status}`);
      }

      const json: GSTSearchResponse = await res.json();
      return json;
    } catch (e: any) {
      console.warn('[eInvoiceService] searchGSTIN failed:', e.message);
      throw e;
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const eInvoiceService = new EInvoiceService();
