import { useCallback, useState } from 'react';

import { getHistorialData, searchStocks, getStockDetails } from '../services/marketDataService';

const useMarketData = () => {
  const [currentPrice, setCurrentPrice] = useState(null);
  const [stockDetails, setStockDetails] = useState(null);
  const [history, setHistory] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(/** @type {boolean | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const runRequest = useCallback(async (
    /** @type {() => Promise<any>} */ request,
    /** @type {(data: any) => void} */ onSuccess,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await request();
      onSuccess(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message || 'Failed to load market data');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStockDetails = useCallback(
    (/** @type {string} */ symbol) => runRequest(() => getStockDetails(symbol), setStockDetails),
    [runRequest],
  );
  const fetchHistoricalData = useCallback(
    (/** @type {string} */ symbol, period = '1mo') =>
      runRequest(() => getHistorialData(symbol, period), setHistory),
    [runRequest],
  );
  const fetchSearchResults = useCallback(
    (/** @type {string} */ query) => runRequest(() => searchStocks(query), setSearchResults),
    [runRequest],
  );

  const reset = useCallback(() => {
    setCurrentPrice(null);
    setStockDetails(null);
    setHistory(null);
    setSearchResults([]);
    setError(null);
    setLoading(false);
  }, []);
  return {
    stockDetails,
    history,
    searchResults,
    loading,
    error,
    fetchStockDetails,
    fetchSearchResults,
    fetchHistoricalData,
    reset,
  };
};
export { useMarketData };
