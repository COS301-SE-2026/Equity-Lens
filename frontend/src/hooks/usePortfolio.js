import { useState, useEffect, useCallback } from 'react';
import { getPortfolio } from '../services/portfolioService';

const usePortfolio = () => {
  const [portfolioData, setPortfolioData] = useState(/** @type {any} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [fetchedAt, setFetchedAt] = useState(/** @type {Date|null} */ (null));

  const fetchPortfolio = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const data = await getPortfolio();
      setPortfolioData(data);
      setFetchedAt(new Date());
    } catch (err) {
      console.warn('portfolio fetch failed:', err);
      const message =
        err && typeof err === 'object' && 'response' in err
          ? /** @type {any} */ (err).response?.data?.detail : err instanceof Error ? err.message : null;
      setError(message || 'Failed to load portfolio data');
    } finally {
      if (!quiet) setLoading(false);
    }

  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const refreshQuietly = useCallback(() => fetchPortfolio(true), [fetchPortfolio]);

  return { portfolioData, loading, error, fetchedAt, refetch: fetchPortfolio, refreshQuietly };
};

export default usePortfolio;