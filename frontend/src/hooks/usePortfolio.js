import { useState, useEffect } from 'react';
import { getPortfolio } from '../services/portfolioService';

const usePortfolio = () => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

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
        setError(err.response?.data?.detail || err.message || 'Failed to load portfolio data');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  return { portfolioData, loading, error, fetchedAt };
};

export default usePortfolio;