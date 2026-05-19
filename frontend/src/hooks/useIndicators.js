import { useState, useEffect } from 'react';
import { getMockIndicatorData } from '../services/indicatorService';

const useIndicators = () => {
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIndicators = async () => {
      setLoading(true);
      try {
        // Use mock data for Demo 1
        // Replace with actual API call when backend is ready:
        // const res = await fetch('http://localhost:8000/api/indicators');
        // const data = await res.json();

        const data = getMockIndicatorData();
        const mapped = Object.fromEntries(
          data.map((stock) => [stock.ticker, { loading: false, results: stock }])
        );
        setStockData(mapped);
      } catch (err) {
        setError(err.message || 'Failed to load indicators');
      } finally {
        setLoading(false);
      }
    };

    fetchIndicators();
  }, []);

  return { stockData, loading, error };
};

export default useIndicators;