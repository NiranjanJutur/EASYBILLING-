/**
 * GST Number Verification Service
 * ─────────────────────────────────
 * Real-time, free GSTIN validation.
 * 
 * Format: 22AAAAA0000A1Z5  (15 characters)
 * Structure:
 *   [0-1]  State code (01–37)
 *   [2-11] PAN of the entity
 *   [12]   Entity number (1-9 for first, Z for default)
 *   [13]   'Z' (default for now)
 *   [14]   Checksum digit (Luhn mod-36)
 */

export interface GSTVerificationResult {
    valid: boolean;
    gstin: string;
    stateCode: string;
    stateName: string;
    panNumber: string;
    entityType: string;
    error?: string;
}

// Indian state codes for GSTIN
const STATE_CODES: Record<string, string> = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
    '29': 'Karnataka', '30': 'Goa', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar',
    '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
    '97': 'Other Territory',
};

// PAN 4th character → Entity type
const ENTITY_TYPES: Record<string, string> = {
    'C': 'Company',
    'P': 'Individual (Person)',
    'H': 'Hindu Undivided Family (HUF)',
    'F': 'Firm / LLP',
    'A': 'Association of Persons (AOP)',
    'T': 'Trust',
    'B': 'Body of Individuals (BOI)',
    'L': 'Local Authority',
    'J': 'Artificial Juridical Person',
    'G': 'Government',
};

/**
 * Luhn mod-36 checksum validation for GSTIN
 * The last character of a valid GSTIN is a checksum calculated
 * using the Luhn algorithm over the first 14 characters.
 */
function validateGSTINChecksum(gstin: string): boolean {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const input = gstin.toUpperCase();
    
    let factor = 2;
    let sum = 0;
    
    for (let i = input.length - 2; i >= 0; i--) {
        let codePoint = chars.indexOf(input[i]);
        if (codePoint < 0) return false;
        
        let addend = factor * codePoint;
        factor = factor === 2 ? 1 : 2;
        addend = Math.floor(addend / 36) + (addend % 36);
        sum += addend;
    }
    
    const remainder = sum % 36;
    const checkChar = chars[(36 - remainder) % 36];
    return checkChar === input[input.length - 1];
}

/**
 * Validate GSTIN format and structure (FREE — no API needed)
 * This catches virtually all invalid GSTINs using:
 *   1. Length check (exactly 15 chars)
 *   2. Regex pattern matching
 *   3. Valid Indian state code check
 *   4. PAN structure validation
 *   5. Luhn mod-36 checksum verification
 */
export function verifyGSTIN(gstin: string): GSTVerificationResult {
    const cleaned = gstin.replace(/\s+/g, '').toUpperCase();
    
    // Base result
    const baseResult: GSTVerificationResult = {
        valid: false,
        gstin: cleaned,
        stateCode: '',
        stateName: '',
        panNumber: '',
        entityType: '',
    };
    
    // 1. Length check
    if (cleaned.length !== 15) {
        return { ...baseResult, error: 'GSTIN must be exactly 15 characters' };
    }
    
    // 2. Regex pattern: 2-digit state + 10-char PAN + entity num + Z + checksum
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(cleaned)) {
        return { ...baseResult, error: 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5' };
    }
    
    // 3. State code validation
    const stateCode = cleaned.substring(0, 2);
    const stateName = STATE_CODES[stateCode];
    if (!stateName) {
        return { ...baseResult, stateCode, error: `Invalid state code: ${stateCode}` };
    }
    
    // 4. Extract PAN and validate its structure
    const panNumber = cleaned.substring(2, 12);
    const entityChar = panNumber[3];
    const entityType = ENTITY_TYPES[entityChar] || 'Unknown';
    
    // 5. Checksum verification (Luhn mod-36)
    if (!validateGSTINChecksum(cleaned)) {
        return {
            ...baseResult,
            stateCode,
            stateName,
            panNumber,
            entityType,
            error: 'Checksum verification failed — this GSTIN number is invalid',
        };
    }
    
    // All checks passed!
    return {
        valid: true,
        gstin: cleaned,
        stateCode,
        stateName,
        panNumber,
        entityType,
    };
}

/**
 * Real-time verification as user types.
 * Returns partial info even for incomplete GSTINs.
 */
export function getPartialGSTINInfo(gstin: string): {
    stateCode?: string;
    stateName?: string;
    panNumber?: string;
    entityType?: string;
    lengthOk: boolean;
    hint: string;
} {
    const cleaned = gstin.replace(/\s+/g, '').toUpperCase();
    
    if (cleaned.length === 0) {
        return { lengthOk: false, hint: 'Enter 15-character GSTIN (e.g. 36AABCT1332L1ZL)' };
    }
    
    if (cleaned.length < 2) {
        return { lengthOk: false, hint: `${15 - cleaned.length} more characters needed` };
    }
    
    const stateCode = cleaned.substring(0, 2);
    const stateName = STATE_CODES[stateCode];
    
    if (cleaned.length < 12) {
        return {
            stateCode,
            stateName: stateName || `Unknown state (${stateCode})`,
            lengthOk: false,
            hint: `${15 - cleaned.length} more characters needed`,
        };
    }
    
    const panNumber = cleaned.substring(2, 12);
    const entityChar = panNumber[3];
    const entityType = ENTITY_TYPES[entityChar] || 'Unknown';
    
    if (cleaned.length < 15) {
        return {
            stateCode,
            stateName: stateName || `Unknown state (${stateCode})`,
            panNumber,
            entityType,
            lengthOk: false,
            hint: `${15 - cleaned.length} more characters needed`,
        };
    }
    
    return {
        stateCode,
        stateName,
        panNumber,
        entityType,
        lengthOk: true,
        hint: 'Ready to verify',
    };
}
