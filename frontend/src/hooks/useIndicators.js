import { useState, useEffect } from 'react';
import { getIndicatorData } from '../services/indicatorService';

const useIndicators = () => {
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIndicators = async () => {
      setLoading(true);
      try {
       
        const data = await getIndicatorData();
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