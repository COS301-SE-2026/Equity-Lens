import { useState, useEffect } from 'react';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlistService';

const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWatchlist = async () => {
    try {
      setError(null);
      const data = await getWatchlist();
      setWatchlist(data.watchlist || data || []);
    } catch (err) {
      console.warn('Watchlist fetch failed:', err);
      setError(err.response?.data?.detail || 'Failed to load watchlist');
    } finally { setLoading(false); }};

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const addTicker = async (ticker) => {
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) { return; }

    try {
      await addToWatchlist(cleaned);
      await fetchWatchlist();
    } catch (err) { console.error('Failed to add ticker:', err); throw err; }};

  const removeTicker = async (watchlistId) => {
    try {
      await removeFromWatchlist(watchlistId);
      await fetchWatchlist();
    } catch (err) { console.error('Failed to remove ticker:', err); throw err; }};

  return { watchlist, loading, error, refresh: fetchWatchlist, addTicker, removeTicker, };
};

export default useWatchlist;