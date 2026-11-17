/**
 * eWayBillService.ts — Masters India GSP e-Way Bill (EWB) service.
 *
 * Responsibilities:
 *   1. Generate an EWB number from a Transaction + transport details.
 *   2. Update vehicle number on an existing EWB (Part B update).
 *   3. Check EWB validity / remaining hours.
 *   4. Cancel an EWB (within 24 hrs of generation).
 *
 * Usage:
 *   import { eWayBillService } from '../gst/eWayBillService';
 *
 *   const ewb = await eWayBillService.generateEWB(transaction, transportDetails);
 *   // ewb.ewayBillNo — attach to shipment docs
 *   // ewb.validUpto  — show countdown to driver
 *
 * All portal calls go through the gsp-proxy Edge Function, which holds the
 * GSP credentials. See SUPABASE_SETUP.md → "GST portal".
 */

import type { Transaction } from '../../models/Transaction';
import type {
  EWayBillRequest,
  EWayBillResponse,
  EWayBillItem,
  GstRate,
  TransportMode,
} from './gstTypes';

// ── Config from shared env resolver ──────────────────────────────────────────

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

// ── Transport details passed by the caller ────────────────────────────────────

export interface TransportDetails {
  vehicleNo?: string;          // e.g. 'KA01AB1234'
  vehicleType?: 'R' | 'O';    // R = Regular, O = Over-dimensional
  transporterId?: string;      // Transporter GSTIN (optional)
  transporterName?: string;
  transDocNo?: string;         // LR/RR number
  transMode?: TransportMode;   // '1'=Road (default), '2'=Rail, '3'=Air, '4'=Ship
  transDistance: number;       // km — used to compute validity
  buyerGstin?: string;
  buyerName?: string;
  buyerAddr1?: string;
  buyerPlace?: string;
  buyerPincode?: number;
  buyerStateCode?: number;
}

// ── Validity helper ───────────────────────────────────────────────────────────

/**
 * Returns validity in hours.
 * Rule: 1 day (24 hrs) per 100 km, minimum 1 day.
 * Over-dimensional cargo (ODC): 1 day per 20 km.
 */
export function computeEWBValidityHours(
  distanceKm: number,
  vehicleType: 'R' | 'O' = 'R',
): number {
  const kmPerDay = vehicleType === 'O' ? 20 : 100;
  const days = Math.max(1, Math.ceil(distanceKm / kmPerDay));
  return days * 24;
}

/**
 * Returns true if an EWB is still valid given its validUpto string.
 * validUpto format from API: 'YYYY-MM-DD HH:mm:ss'
 */
export function isEWBValid(validUpto: string): boolean {
  const expiry = new Date(validUpto.replace(' ', 'T'));
  return expiry.getTime() > Date.now();
}

/**
 * Returns remaining hours on an EWB (0 if expired).
 */
export function ewbRemainingHours(validUpto: string): number {
  const expiry = new Date(validUpto.replace(' ', 'T'));
  const ms = expiry.getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
}

// ── EWayBillService ───────────────────────────────────────────────────────────

class EWayBillService {
  // GSP login and the auth token are handled by the gsp-proxy Edge Function.

  private postToGsp(path: '/ewb/api/ewayapi/GenEWayBill' | '/ewb/api/ewayapi/UpdateVehicle' | '/ewb/api/ewayapi/CancelEWayBill', body: unknown) {
    return gspRequest({ path, gstin: getActiveSeller().gstin, body });
  }

  // ── Payload builder ───────────────────────────────────────────────────────

  public buildPayload(
    tx: Transaction,
    transport: TransportDetails,
  ): EWayBillRequest {
    const seller = getActiveSeller();
    const isInterstate =
      transport.buyerStateCode !== undefined &&
      transport.buyerStateCode !== Number(seller.stateCode);

    const txDate = new Date(tx.timestamp);
    const docDate = [
      String(txDate.getDate()).padStart(2, '0'),
      String(txDate.getMonth() + 1).padStart(2, '0'),
      String(txDate.getFullYear()),
    ].join('/');

    const itemList: EWayBillItem[] = tx.items.map(item => {
      const gstRt = (item.gst ?? 0) as GstRate;
      const taxableAmount = Math.round(item.price * item.qty * 100) / 100;
      const halfRate = (gstRt / 2) as GstRate;

      return {
        productName: item.name.slice(0, 100),
        productDesc: item.name.slice(0, 100),
        hsnCode: '0000',   // TODO: pull from Product.hsnCode when added
        quantity: item.qty,
        qtyUnit: item.unit?.toUpperCase() ?? 'NOS',
        taxableAmount,
        cgstRate: isInterstate ? 0 : halfRate,
        sgstRate: isInterstate ? 0 : halfRate,
        igstRate: isInterstate ? gstRt : 0,
        cessRate: 0,
      };
    });

    return {
      supplyType: 'O',
      subSupplyType: '1',
      docType: 'INV',
      docNo: tx.billNo.slice(0, 16),
      docDate,
      fromGstin: seller.gstin,
      fromTrdName: seller.name,
      fromAddr1: seller.addr1,
      fromPlace: seller.place,
      fromPincode: seller.pincode,
      fromStateCode: Number(seller.stateCode),
      toGstin: transport.buyerGstin ?? 'URP',
      toTrdName: transport.buyerName ?? tx.customerName ?? 'Customer',
      toAddr1: transport.buyerAddr1 ?? 'NA',
      toPlace: transport.buyerPlace ?? seller.place,
      toPincode: transport.buyerPincode ?? seller.pincode,
      toStateCode: transport.buyerStateCode ?? Number(seller.stateCode),
      totalValue: tx.grandTotal,
      cgstValue: isInterstate ? 0 : Math.round((tx.totalGST / 2) * 100) / 100,
      sgstValue: isInterstate ? 0 : Math.round((tx.totalGST / 2) * 100) / 100,
      igstValue: isInterstate ? tx.totalGST : 0,
      cessValue: 0,
      transporterId: transport.transporterId,
      transporterName: transport.transporterName,
      transDocNo: transport.transDocNo,
      transMode: transport.transMode ?? '1',
      transDistance: transport.transDistance,
      vehicleNo: transport.vehicleNo,
      vehicleType: transport.vehicleType ?? 'R',
      itemList,
    };
  }

  // ── Main: Generate EWB ────────────────────────────────────────────────────

  /**
   * Generates a new e-Way Bill for a completed transaction.
   *
   * Required when:
   *   - Goods value > ₹50,000
   *   - Movement is inter-state OR intra-state (if state mandates it)
   *
   * @param tx         Completed Transaction
   * @param transport  Transport details (vehicle no., distance, buyer address)
   * @returns EWayBillResponse.data with ewayBillNo + validUpto
   */
  public async generateEWB(
    tx: Transaction,
    transport: TransportDetails,
  ): Promise<NonNullable<EWayBillResponse['data']>> {
    const payload = this.buildPayload(tx, transport);

    console.log('[eWayBillService] Generating EWB for bill:', tx.billNo);

    const res = await this.postToGsp('/ewb/api/ewayapi/GenEWayBill', payload);

    if (!res.ok) throw new Error(`[eWayBillService] HTTP error: ${res.status}`);

    const json: EWayBillResponse = await res.json();

    if (json.status !== '1' || !json.data?.ewayBillNo) {
      const codes = json.errorCodes?.join(', ') ?? '';
      throw new Error(
        `[eWayBillService] EWB generation failed: ${json.error ?? 'Unknown'} ${codes}`.trim(),
      );
    }

    console.log('[eWayBillService] EWB generated:', json.data.ewayBillNo,
      '| Valid until:', json.data.validUpto);

    return json.data;
  }

  // ── Part B Update (vehicle number) ───────────────────────────────────────

  /**
   * Updates the vehicle number on an existing EWB (Part B update).
   * Call this when the transporter changes the vehicle en route.
   *
   * @param ewayBillNo  12-digit EWB number
   * @param vehicleNo   New vehicle number e.g. 'KA01AB1234'
   * @param fromPlace   Place where vehicle is changed
   * @param fromState   State code where vehicle is changed
   * @param reasonCode  '1'=Due to Break Down, '2'=Due to Trans Shipment, '3'=Others, '4'=First Time
   */
  public async updateVehicle(
    ewayBillNo: string,
    vehicleNo: string,
    fromPlace: string,
    fromState: number,
    transMode: TransportMode = '1',
    reasonCode: '1' | '2' | '3' | '4' = '4',
    remarkReason?: string,
  ): Promise<void> {
    const res = await this.postToGsp('/ewb/api/ewayapi/UpdateVehicle', {
      ewbNo: ewayBillNo,
      vehicleNo,
      fromPlace,
      fromState,
      transMode,
      reasonCode,
      remarkReason: remarkReason ?? 'Vehicle updated',
    });

    if (!res.ok) throw new Error(`[eWayBillService] UpdateVehicle HTTP error: ${res.status}`);

    const json = await res.json();
    if (json.status !== '1') {
      throw new Error(`[eWayBillService] UpdateVehicle failed: ${json.error ?? 'Unknown'}`);
    }

    console.log('[eWayBillService] Vehicle updated on EWB:', ewayBillNo, '→', vehicleNo);
  }

  // ── Cancel EWB ────────────────────────────────────────────────────────────

  /**
   * Cancels an EWB within 24 hours of generation.
   *
   * @param ewayBillNo  12-digit EWB number
   * @param cancelRsnCode '1'=Duplicate, '2'=Order Cancelled, '3'=Data Entry Mistake, '4'=Others
   * @param cancelRmrk  Optional remark (max 100 chars)
   */
  public async cancelEWB(
    ewayBillNo: string,
    cancelRsnCode: '1' | '2' | '3' | '4' = '4',
    cancelRmrk?: string,
  ): Promise<void> {
    const res = await this.postToGsp('/ewb/api/ewayapi/CancelEWayBill', {
      ewbNo: ewayBillNo,
      cancelRsnCode,
      cancelRmrk: cancelRmrk?.slice(0, 100) ?? 'Cancelled',
    });

    if (!res.ok) throw new Error(`[eWayBillService] CancelEWB HTTP error: ${res.status}`);

    const json = await res.json();
    if (json.status !== '1') {
      throw new Error(`[eWayBillService] CancelEWB failed: ${json.error ?? 'Unknown'}`);
    }

    console.log('[eWayBillService] EWB cancelled:', ewayBillNo);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const eWayBillService = new EWayBillService();
