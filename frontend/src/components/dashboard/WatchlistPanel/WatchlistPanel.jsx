import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { GlassPanel } from '../shared/GlassPanel';
import WatchlistItem from '../WatchlistItem/WatchlistItem';
import useWatchlist from '../../../hooks/useWatchlist';

const VISIBLE_LIMIT = 3;

const WatchlistPanel = () => {
  const { watchlist, loading, error, addTicker } = useWatchlist();
  const [adding, setAdding] = useState(false);
  const [ticker, setTicker] = useState('');
  const [submitting, setSubmitting] = useState(false);
    /** @type {import('react').RefObject<HTMLInputElement>} */
  const tickerInputRef = useRef(null);

  useEffect(() => {
    if (adding) tickerInputRef.current?.focus();
  }, [adding]);

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addTicker(ticker);
      setTicker('');
      setAdding(false);
    } catch (err) {
      console.warn('add to watchlist failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlassPanel>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          WATCHLIST
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 font-mono text-[9px]"
          style={{ color: adding ? 'var(--accent-primary)' : 'var(--text-ghost)' }}
        >
          <Plus size={11} /> ADD
        </button>
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="flex gap-2 px-3 pt-3">
          <input
            ref={tickerInputRef}
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="e.g. NPN"
            className="min-w-0 flex-1 rounded-md px-2.5 py-1.5 font-mono text-[11px] focus:outline-none"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            disabled={submitting || !ticker.trim()}
            className="rounded-md px-3 font-mono text-[11px] font-medium disabled:opacity-40"
            style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
          >
            {submitting ? '...' : 'Add'}
          </button>
        </form>
      )}

      <div className="px-3 pb-1 pt-1">
        {loading ? (
          <div className="animate-pulse space-y-2 py-2">
            <div className="h-8 rounded" style={{ background: 'var(--border-subtle)' }} />
            <div className="h-8 rounded" style={{ background: 'var(--border-subtle)' }} />
          </div>
        ) : error ? (
          <p className="py-3 text-[11px]" style={{ color: 'var(--signal-negative)' }}>
            Couldn&apos;t load your watchlist.
          </p>
        ) : watchlist.length === 0 ? (
          <p className="py-3 text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            No stocks tracked yet - add a ticker to follow it here.
          </p>
        ) : (
          watchlist.slice(0, VISIBLE_LIMIT).map((item) => (
            <WatchlistItem
              key={item.id}
              ticker={item.ticker}
              name={item.company_name || item.ticker}
              price={item.current_price ?? 0}
              changePercent={item.change_percent ?? 0}
            />
          ))
        )}
      </div>
    </GlassPanel>
  );
};

export default WatchlistPanel;
