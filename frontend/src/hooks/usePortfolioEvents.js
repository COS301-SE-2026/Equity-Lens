import { useState, useEffect, useCallback } from 'react';

import { getEventDetail, getPortfolioEvents } from '../services/portfolioService';

const usePortfolioEvents = () => {
  const [events, setEvents] = useState(/** @type {any} */ (null));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [details, setDetails] = useState(/** @type {Record<string, any>} */ ({}));
  const [pendingKey, setPendingKey] = useState(/** @type {string|null} */ (null));
  const [lastDetail, setLastDetail] = useState(/** @type {any} */ (null));

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setEvents(await getPortfolioEvents());
    } catch (err) {
      console.warn('portfolio events fetch failed:', err);
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const loadDetail = useCallback(
    async (/** @type {string} */ ticker, /** @type {string} */ date) => {
      const key = `${ticker}:${date}`;
      if (details[key] || pendingKey === key) return;

      setPendingKey(key);
      try {
        const detail = await getEventDetail(ticker, date);
        setDetails((current) => ({ ...current, [key]: detail }));
        setLastDetail({ ...detail, ticker, date });
      } catch (err) {
        console.warn('event detail fetch failed:', err);
        setDetails((current) => ({ ...current, [key]: { error: true } }));
      }
      setPendingKey(null);
    },
    [details, pendingKey],
  );

  return {
    events, loading, failed, details, pendingKey, lastDetail, loadDetail,
    refetch: fetchEvents,
  };
};

export default usePortfolioEvents;
