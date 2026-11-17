/**
 * src/services/gst/index.ts — barrel export for GST compliance services.
 *
 * Import in BillingManager or any screen:
 *
 *   import { eInvoiceService, eWayBillService } from '../services/gst';
 *   import type { GstComplianceRecord, TransportDetails } from '../services/gst';
 */

export { eInvoiceService } from './eInvoiceService';
export { eWayBillService } from './eWayBillService';
export { computeEWBValidityHours, isEWBValid, ewbRemainingHours } from './eWayBillService';
export type { TransportDetails } from './eWayBillService';
export type {
  GstComplianceRecord,
  EInvoiceRequest,
  EInvoiceResponse,
  EWayBillRequest,
  EWayBillResponse,
  GstRate,
  SupplyType,
  TransportMode,
} from './gstTypes';
