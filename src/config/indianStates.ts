/**
 * Indian States & Union Territories with GST State Codes.
 * The first 2 digits of a GSTIN represent the state code.
 */

export interface IndianState {
  code: string;   // 2-digit GST state code
  name: string;
  nameKn?: string; // Kannada name (optional)
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' },
  { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka', nameKn: 'ಕರ್ನಾಟಕ' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

/** Lookup state by GST code */
export const getStateByCode = (code: string): IndianState | undefined =>
  INDIAN_STATES.find(s => s.code === code);

/** Lookup state by name (case-insensitive) */
export const getStateByName = (name: string): IndianState | undefined =>
  INDIAN_STATES.find(s => s.name.toLowerCase() === name.toLowerCase());

/** Validate GSTIN format: 15 chars, first 2 digits = state code */
export const isValidGSTIN = (gstin: string): boolean => {
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gstin)) return false;
  const stateCode = gstin.substring(0, 2);
  return INDIAN_STATES.some(s => s.code === stateCode);
};

/** Extract state code from GSTIN */
export const getStateCodeFromGSTIN = (gstin: string): string => gstin.substring(0, 2);
