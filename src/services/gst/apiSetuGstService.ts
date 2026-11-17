/**
 * API Setu (Government of India) GSTIN Verification Service
 * ────────────────────────────────────────────────────────
 * Official, free, and reliable government-backed API gateway.
 * 
 * Documentation: https://apisetu.gov.in
 */

const API_SETU_BASE_URL = 'https://apisetu.gov.in/api/v1/gst';

export interface ApiSetuGstResponse {
    lglNm: string;
    trdNm?: string;
    addr?: {
        bno?: string;
        flno?: string;
        loc?: string;
        st?: string;
        pncd?: string;
    };
    sts?: string;
    ctb?: string;
}

export class ApiSetuGstService {
    /**
     * Fetches taxpayer details using API Setu.
     * Requires an API Key from apisetu.gov.in
     */
    static async searchGSTIN(gstin: string, apiKey: string): Promise<ApiSetuGstResponse> {
        try {
            const response = await fetch(`${API_SETU_BASE_URL}/taxpayer/${gstin}`, {
                method: 'GET',
                headers: {
                    'X-APISETU-APIKEY': apiKey,
                    'X-APISETU-CLIENTID': 'SMS_APPLICATION', // Replace with your client ID
                    'accept': 'application/json',
                },
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API Setu Error: ${response.status} - ${err}`);
            }

            const data = await response.json();
            return data;
        } catch (e: any) {
            console.error('[ApiSetuGstService] fetch failed:', e.message);
            throw e;
        }
    }
}
