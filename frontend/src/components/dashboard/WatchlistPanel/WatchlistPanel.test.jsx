import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WatchlistPanel from './WatchlistPanel';

// new
const addTicker = vi.fn();

/**
 * @typedef {{
 *   watchlist: { id: string, ticker: string, company_name?: string, current_price?: number, change_percent?: number }[],
 *   loading: boolean,
 *   error: string|null,
 *   addTicker: typeof addTicker,
 *   removeTicker: () => void,
 * }} MockWatchlistState
 */

/** @type {MockWatchlistState} */
let mockState;

vi.mock('../../../hooks/useWatchlist', () => ({
  default: () => mockState,
}));

describe('WatchlistPanel', () => {
  beforeEach(() => {
    addTicker.mockClear();
    mockState = {
      watchlist: [{ id: 'w1', ticker: 'ABG', company_name: 'Absa Group', current_price: 182.5, change_percent: 1.2 }],
      loading: false,
      error: null,
      addTicker,
      removeTicker: vi.fn(),
    };
  });

  it('renders real watchlist data instead of a hardcoded list', () => {
    render(<WatchlistPanel />);
    expect(screen.getByText('ABG')).toBeInTheDocument();
    expect(screen.getByText('Absa Group')).toBeInTheDocument();
  });

  it('shows an empty state with no fake placeholder tickers', () => {
    mockState = { ...mockState, watchlist: [] };
    render(<WatchlistPanel />);
    expect(screen.getByText(/no stocks tracked yet/i)).toBeInTheDocument();
  });

  it('opens a ticker input on + Add and calls addTicker on submit', async () => {
    render(<WatchlistPanel />);
    fireEvent.click(screen.getByText('Add'));

    const input = screen.getByPlaceholderText('e.g. NPN');
    fireEvent.change(input, { target: { value: 'sbk' } });
    fireEvent.click(screen.getByText('Add', { selector: 'button[type="submit"]' }));

    expect(addTicker).toHaveBeenCalledWith('sbk');
  });

  it('calls removeTicker with the item id when its remove button is clicked', () => {
    render(<WatchlistPanel />);
    fireEvent.click(screen.getByTitle('Remove ABG from watchlist'));
    expect(mockState.removeTicker).toHaveBeenCalledWith('w1');
  });
});
