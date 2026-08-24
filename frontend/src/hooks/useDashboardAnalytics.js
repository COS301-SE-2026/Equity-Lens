import { useState, useEffect, useCallback } from 'react';

import { getMarketContext, getAnomalies } from '../services/portfolioService';

const useDashboardAnalytics = () => {
  const [marketContext, setMarketContext] = useState(/** @type {any} */ (null));
  const [anomalies, setAnomalies] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [market, anomaliesResult] = await Promise.allSettled([
      getMarketContext(),
      getAnomalies(),
    ]);

    if (market.status === 'fulfilled') setMarketContext(market.value);
    else console.warn('market context fetch failed:', market.reason);

    if (anomaliesResult.status === 'fulfilled') setAnomalies(anomaliesResult.value ?? []);
    else console.warn('anomalies fetch failed:', anomaliesResult.reason);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    marketContext,
    anomalies,
    loading,
    refetch: fetchAll,
  };
};

export default useDashboardAnalytics;
