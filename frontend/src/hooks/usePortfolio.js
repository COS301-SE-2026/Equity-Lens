import { useState, useEffect } from 'react';
import { getMockPortfolioData } from '../services/portfolioService';

const usePortfolio = () => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        // Use mock data for Demo 1
        // Replace with actual API call when backend is ready:
        // const data = await getPortfolioSummary();
        const data = getMockPortfolioData();
        setPortfolioData(data);
      } catch (err) {
        setError(err.message || 'Failed to load portfolio data');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  return { portfolioData, loading, error };
};

export default usePortfolio;