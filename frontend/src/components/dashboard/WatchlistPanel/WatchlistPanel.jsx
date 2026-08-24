import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import WatchlistItem from '../WatchlistItem/WatchlistItem';
import useWatchlist from '../../../hooks/useWatchlist';
import { searchStocks } from '../../../services/marketDataService';

const VISIBLE_LIMIT = 3;
const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;

const WatchlistPanel = () => {
  const { watchlist, loading, error, addTicker, removeTicker } = useWatchlist();
  const [adding, setAdding] = useState(false);
  const [ticker, setTicker] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState(/** @type {string|null} */ (null));
  const [suggestions, setSuggestions] = useState(/** @type {{symbol:string, name:string}[]} */ ([]));
  const [suggestStatus, setSuggestStatus] = useState('idle'); // idle | loading | done | no-results | error
  const [activeIndex, setActiveIndex] = useState(-1);

    /** @type {import('react').RefObject<HTMLInputElement>} */
  const tickerInputRef = useRef(null);
  /** @type {import('react').MutableRefObject<AbortController|null>} */
  const searchAbortRef = useRef(null);

  useEffect(() => {
    if (adding) tickerInputRef.current?.focus();
  }, [adding]);

  const resetSuggestions = () => {
    setSuggestions([]);
    setSuggestStatus('idle');
    setActiveIndex(-1);
  };

  useEffect(() => {
    const query = ticker.trim();
    if (!adding || query.length < SEARCH_MIN_CHARS) {
      resetSuggestions();
      return;
    }

    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSuggestStatus('loading');
      try {
        const data = await searchStocks(query, controller.signal);
        if (searchAbortRef.current !== controller) return; // superseded by a newer search
        const results = data?.results ?? [];
        setSuggestions(results);
        setSuggestStatus(results.length === 0 ? 'no-results' : 'done');
        setActiveIndex(-1);
      } catch (err) {
        if (searchAbortRef.current !== controller) return; // aborted/superseded, not a real failure
        console.warn('ticker search failed:', err);
        setSuggestions([]);
        setSuggestStatus('error');
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [ticker, adding]);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  /** @param {{symbol:string, name:string}} suggestion */
  const selectSuggestion = (suggestion) => {
    setTicker(suggestion.symbol);
    resetSuggestions();
    tickerInputRef.current?.focus();
  };

  /** @param {React.KeyboardEvent<HTMLInputElement>} e */
  const handleTickerKeyDown = (e) => {
    if (suggestStatus !== 'done' || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      // a suggestion is highlighted - fill the input instead of submitting the form
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      resetSuggestions();
    }
  };

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker.trim() || submitting) return;
    setSubmitting(true);
    setAddError(null);
    try {
      await addTicker(ticker);
      setTicker('');
      setAdding(false);
      resetSuggestions();
    } catch (err) {
      console.warn('add to watchlist failed:', err);
      const detail = /** @type {any} */ (err)?.response?.data?.detail;
      setAddError(typeof detail === 'string' ? detail : 'Could not add that ticker.');
    } finally {
      setSubmitting(false);
    }
  };

  /** @param {string} watchlistId */
  const handleRemove = async (watchlistId) => {
    try {
      await removeTicker(watchlistId);
    } catch (err) {
      console.warn('remove from watchlist failed:', err);
    }
  };
  const showDropdown = adding && suggestStatus !== 'idle';

  return (
    <>
      <div className="flex items-center justify-end px-3 pt-3">
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); setAddError(null); }}
          className="flex items-center gap-1 font-mono text-[9px]"
          style={{ color: adding ? 'var(--accent-primary)' : 'var(--text-ghost)' }}
        >
          <Plus size={11} /> Add
        </button>
      </div>

      {adding && (
        <>
        <form onSubmit={handleSubmit} className="relative flex gap-2 px-3 pt-3">
          <div className="relative min-w-0 flex-1">
          <input
            ref={tickerInputRef}
            type="text"
            role="combobox"
            value={ticker}
            onChange={(e) => { setTicker(e.target.value); setAddError(null); }}
            onKeyDown={handleTickerKeyDown}
            placeholder="e.g. NPN"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={suggestStatus === 'done'}
            aria-controls="watchlist-suggestion-listbox"
            aria-activedescendant={activeIndex >= 0 ? `watchlist-suggestion-${activeIndex}` : undefined}
            className="w-full min-w-0 rounded-md px-2.5 py-1.5 font-mono text-[11px] focus:outline-none"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />

            {showDropdown && (
              <div
                className="glass-surface-elevated absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md py-1"
              >
                {suggestStatus === 'loading' && (
                  <div className="px-2.5 py-1.5 font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                    Searching…
                  </div>
                )}
                {suggestStatus === 'error' && (
                  <div className="px-2.5 py-1.5 font-mono text-[10px]" style={{ color: 'var(--signal-negative)' }}>
                    Search failed
                  </div>
                )}
                {suggestStatus === 'no-results' && (
                  <div className="px-2.5 py-1.5 font-mono text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                    No matches
                  </div>
                )}
                {suggestStatus === 'done' && (
                  <ul id="watchlist-suggestion-listbox" role="listbox" aria-label="Ticker suggestions">
                    {suggestions.map((s, i) => (
                      <li
                        key={s.symbol}
                        id={`watchlist-suggestion-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(s);
                        }}
                        className="cursor-pointer px-2.5 py-1.5 font-mono text-[11px]"
                        style={{ background: i === activeIndex ? 'var(--surface-hover)' : 'transparent' }}
                      >
                        <span className="font-bold">{s.symbol}</span>{' '}
                        <span style={{ color: 'var(--text-ghost)' }}>{s.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !ticker.trim()}
            className="rounded-md px-3 font-mono text-[11px] font-medium disabled:opacity-40"
            style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
          >
            {submitting ? '...' : 'Add'}
          </button>
        </form>
        {addError && (
          <p className="px-3 pt-1.5 font-mono text-[10px]" style={{ color: 'var(--signal-negative)' }}>
            {addError}
          </p>)}
        </>
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
              onRemove={() => handleRemove(item.id)}
            />
          ))
        )}
      </div>
    </>
  );
};

export default WatchlistPanel;
