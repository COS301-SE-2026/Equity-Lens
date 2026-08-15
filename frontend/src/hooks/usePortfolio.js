import { useState, useEffect } from 'react';

import { getPortfolio } from '../services/portfolioService';

const usePortfolio = () => {
  const [portfolioData, setPortfolioData] = useState(/** @type {any} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [fetchedAt, setFetchedAt] = useState(/** @type {Date|null} */ (null));

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  return { portfolioData, loading, error, fetchedAt };
};

export default usePortfolio;