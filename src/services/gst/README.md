# GST Compliance Services

This folder integrates your SMS billing system with the Indian government's **e-Invoice (IRN)** and **e-Way Bill (EWB)** infrastructure via the **Masters India GSP API**.

## Files

| File | Purpose |
|---|---|
| `gstTypes.ts` | All TypeScript interfaces for GSP API payloads |
| `eInvoiceService.ts` | Generates IRN + signed QR code from a Transaction |
| `eWayBillService.ts` | Generates EWB number, updates vehicle, cancels EWB |
| `index.ts` | Barrel export — import from here |

## Setup

### 1. Get GSP credentials

Sign up at [mastergst.com](https://www.mastergst.com) → Developer → Sandbox.  
You'll receive a `client_id`, `client_secret`, username, and password.

### 2. Add to `.env`

```env
# Masters India GSP
GSP_BASE_URL=https://api.mastergst.com/einvoice/type/EINV/version/V1_03
GSP_USERNAME=your_gsp_username
GSP_PASSWORD=your_gsp_password
GSP_CLIENT_ID=your_client_id
GSP_CLIENT_SECRET=your_client_secret

# Your shop GSTIN + address
SELLER_GSTIN=29XXXXXXXXXXXXX
SELLER_NAME=My Grocery Shop
SELLER_ADDR1=123, MG Road
SELLER_PLACE=Bengaluru
SELLER_PINCODE=560001
SELLER_STATE_CODE=29
```

### 3. Wire into BillingManager checkout

In `BillingManager.ts`, after a successful `addTransaction()` call:

```typescript
import { eInvoiceService, eWayBillService } from '../gst';
import type { TransportDetails } from '../gst';

// After checkout:
const gstRecord = await eInvoiceService.generateIRN(
  transaction,
  customer?.gstin,
  customer?.name,
  customer?.address,
  customer?.city,
  customer?.pincode,
  customer?.stateCode,
);

// Store IRN on the transaction
await supabase
  .from('transactions')
  .update({ irn: gstRecord.irn, eway_bill_no: gstRecord.ewayBillNo })
  .eq('id', transaction.id);
```

### 4. For goods movement > ₹50,000 — generate EWB separately

```typescript
const transport: TransportDetails = {
  vehicleNo: 'KA01AB1234',
  transMode: '1',       // Road
  transDistance: 120,   // km
  buyerGstin: 'BUYER_GSTIN',
  buyerStateCode: 27,   // Maharashtra
};

const ewb = await eWayBillService.generateEWB(transaction, transport);
console.log('EWB No:', ewb.ewayBillNo);
console.log('Valid until:', ewb.validUpto);
```

## Applicability

| Condition | e-Invoice | e-Way Bill |
|---|---|---|
| B2B, turnover > ₹5 Cr | Mandatory | If value > ₹50K |
| B2C | Not required | If value > ₹50K |
| Below ₹50K movement | Not required | Not required |

## Your `Transaction` model already has these fields:

```typescript
irn?: string | null;         // ← store IRN here
ewayBillNo?: string | null;  // ← store EWB number here
```

No schema changes needed — just populate them after generation.

## Sandbox vs Production

- Sandbox URL: `https://api.mastergst.com/einvoice/type/EINV/version/V1_03` (no real IRNs)
- Production URL: Replace with live endpoint from Masters India dashboard after approval
- Switch by changing `GSP_BASE_URL` in `.env` — no code changes needed
