/**
 * TallyIntegrationService.ts
 * ──────────────────────────
 * Handles export of transactions to Tally-compatible XML format.
 * and provides placeholders for E-Invoice / E-Way Bill (Permit) integration.
 */

import { Transaction } from '../../models/Transaction';
import { STORE_INFO } from '../../config/constants';

/**
 * Generates a Tally-compliant XML for a batch of transactions.
 * Uses the simplified "Sales Voucher" format for TallyPrime / Tally.ERP 9.
 */
export const generateTallyXML = (transactions: Transaction[]): string => {
  const store = STORE_INFO;

  let xml = `<?xml version="1.0"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${store.name}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
`;

  transactions.forEach(t => {
    const date = t.timestamp.split('T')[0].replace(/-/g, '');
    const partyName = t.customerName || 'Cash';
    
    xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${t.billNo}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${t.grandTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${t.subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${t.totalGST > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>GST Output</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${t.totalGST.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : ''}
            <NARRATION>IRN: ${t.irn || 'N/A'}${t.ewayBillNo ? ` | E-Way Bill: ${t.ewayBillNo}` : ''}</NARRATION>
            <EINVOICEACKNO>${t.billNo}</EINVOICEACKNO>
            <IRN>${t.irn || ''}</IRN>
          </VOUCHER>
        </TALLYMESSAGE>`;
  });

  xml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return xml;
};

/**
 * E-Invoice (GST IRN) Placeholder
 */
export const generateEInvoice = async (transaction: any): Promise<any> => {
  console.log('[E-Invoice] Generating IRN for:', transaction.billNo);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        irn: `IRN-${Math.random().toString(36).toUpperCase().slice(2, 10)}`,
        qrCode: 'https://gst.gov.in/qr-code-placeholder',
        ackNo: `ACK-${Date.now()}`,
        ackDate: new Date().toISOString()
      });
    }, 200); // 200ms delay for smooth UI
  });
};

/**
 * E-Way Bill (Permit) Placeholder
 */
export const generateEWayBill = async (data: any): Promise<any> => {
  console.log('[E-Way Bill] Generating for:', data.transaction.billNo);
  
  return {
    ewayBillNo: `EWB-${Math.floor(Math.random() * 1000000000000)}`,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'GENERATED'
  };
};
