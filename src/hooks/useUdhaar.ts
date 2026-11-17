import { useState, useEffect, useCallback } from 'react';
import { getCustomers } from '../services/firebase/firestoreService';
import { Customer } from '../models/Customer';

export const useUdhaar = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getCustomers();
            setCustomers(data.filter(c => c.totalOutstanding > 0));
        } catch (error) {
            // This hook loads in the background on screen mount. A temporary
            // offline/database error should not become an unhandled rejection
            // that can close the app after login.
            console.warn('Unable to load outstanding customer balances:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    const totalOutstanding = customers.reduce((sum, c) => sum + (Number(c.totalOutstanding) || 0), 0);
    const topDebtors = [...customers].sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 5);

    return { customers, loading, totalOutstanding, topDebtors, refresh: fetchCustomers };
};
