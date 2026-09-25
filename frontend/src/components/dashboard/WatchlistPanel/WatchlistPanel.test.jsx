import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import WatchlistPanel from './WatchlistPanel';
import { searchStocks } from '../../../services/marketDataService';

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

vi.mock('../../../services/marketDataService', () => ({
  searchStocks: vi.fn(),
}));

describe('WatchlistPanel', () => {
  beforeEach(() => {
    addTicker.mockClear();
    vi.mocked(searchStocks).mockReset();
    vi.mocked(searchStocks).mockResolvedValue({ query: '', results: [] });
    mockState = {
      watchlist: [
        {
          id: 'w1',
          ticker: 'ABG',
          company_name: 'Absa Group',
          current_price: 182.5,
          change_percent: 1.2,
        },
      ],
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

  describe('search suggestions (backlog 7.3)', () => {
    it('does not search below the minimum character count', async () => {
      render(<WatchlistPanel />);
      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('e.g. NPN'), { target: { value: 'n' } });

      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(searchStocks).not.toHaveBeenCalled();
    });

    it('shows suggestions after the debounce once past the minimum length', async () => {
      vi.mocked(searchStocks).mockResolvedValueOnce({
        query: 'na',
        results: [{ symbol: 'NPN.JO', name: 'Naspers Limited' }],
      });
      render(<WatchlistPanel />);
      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('e.g. NPN'), { target: { value: 'na' } });

      expect(await screen.findByText('Naspers Limited', {}, { timeout: 1500 })).toBeInTheDocument();
      expect(searchStocks).toHaveBeenCalledWith('na', expect.anything());
    });

    it('shows a no-results message when the search comes back empty', async () => {
      vi.mocked(searchStocks).mockResolvedValueOnce({ query: 'zzz', results: [] });
      render(<WatchlistPanel />);
      fireEvent.click(screen.getByText('Add'));
      fireEvent.change(screen.getByPlaceholderText('e.g. NPN'), { target: { value: 'zzz' } });

      expect(await screen.findByText(/no matches/i, {}, { timeout: 1500 })).toBeInTheDocument();
    });

    it('moves the selection with arrow keys and fills the input on Enter without submitting', async () => {
      vi.mocked(searchStocks).mockResolvedValueOnce({
        query: 'na',
        results: [
          { symbol: 'NPN.JO', name: 'Naspers Limited' },
          { symbol: 'NRP.JO', name: 'NEPI Rockcastle' },
        ],
      });
      render(<WatchlistPanel />);
      fireEvent.click(screen.getByText('Add'));
      const input = screen.getByPlaceholderText('e.g. NPN');
      fireEvent.change(input, { target: { value: 'na' } });

      await screen.findByText('Naspers Limited', {}, { timeout: 1500 });

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input.value).toBe('NPN.JO');
      expect(addTicker).not.toHaveBeenCalled();
    });

    it('leaves manual entry working when the search fails', async () => {
      vi.mocked(searchStocks).mockRejectedValueOnce(new Error('network down'));
      render(<WatchlistPanel />);
      fireEvent.click(screen.getByText('Add'));
      const input = screen.getByPlaceholderText('e.g. NPN');
      fireEvent.change(input, { target: { value: 'na' } });

      await screen.findByText(/search failed/i, {}, { timeout: 1500 });

      fireEvent.change(input, { target: { value: 'sbk' } });
      fireEvent.click(screen.getByText('Add', { selector: 'button[type="submit"]' }));

      expect(addTicker).toHaveBeenCalledWith('sbk');
    });
  });
});
