import { useState, useEffect } from 'react';

import { getIndicatorData } from '../services/indicatorService';

/**
 * @typedef {{ ticker: string, name: string, [indicator: string]: any }} IndicatorRow
 */

const useIndicators = () => {
  const [stockData, setStockData] = useState(
    /** @type {Record<string, { loading: boolean, results: IndicatorRow }>} */ ({}),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const fetchIndicators = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getIndicatorData();
        const mapped = Object.fromEntries(
          data.map((/** @type {IndicatorRow} */ stock) => [
            stock.ticker,
            { loading: false, results: stock },
          ]),
        );
        setStockData(mapped);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        setError(message || 'Failed to load indicators');
      } finally {
        setLoading(false);
      }
    };

    fetchIndicators();
  }, []);

  return { stockData, loading, error };
};

export default useIndicators;
