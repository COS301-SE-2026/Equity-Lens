import { useState, useEffect } from 'react';

import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlistService';

/**
 * @typedef {{
 *   id: string,
 *   ticker: string,
 *   company_name?: string,
 *   current_price?: number,
 *   change_percent?: number,
 * }} WatchlistItem
 */

// new
const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState(/** @type {WatchlistItem[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const fetchWatchlist = async () => {
    try {
      setError(null);
      const data = await getWatchlist();
      setWatchlist(data.watchlist || data || []);
    } catch (err) {
      console.warn('Watchlist fetch failed:', err);
      const detail = err instanceof Error ? err.message : /** @type {any} */ (err)?.response?.data?.detail;
      setError(detail || 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

    /** @param {string} ticker */
  const addTicker = async (ticker) => {
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) { return; }

    try {
      await addToWatchlist(cleaned);
      await fetchWatchlist();
    } catch (err) { console.error('Failed to add ticker:', err); throw err; }};

  /** @param {string} watchlistId */
  const removeTicker = async (watchlistId) => {
    try {
      await removeFromWatchlist(watchlistId);
      await fetchWatchlist();
    } catch (err) { console.error('Failed to remove ticker:', err); throw err; }};

  return { watchlist, loading, error, refresh: fetchWatchlist, addTicker, removeTicker, };
};

export default useWatchlist;