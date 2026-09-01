import { useState, useEffect, useCallback } from 'react';

import { getMarketContext } from '../services/portfolioService';

const useDashboardAnalytics = () => {
  const [marketContext, setMarketContext] = useState(/** @type {any} */ (null));
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setMarketContext(await getMarketContext());
    } catch (err) {
      console.warn('market context fetch failed:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    marketContext,
    loading,
    refetch: fetchAll,
  };
};

export default useDashboardAnalytics;
