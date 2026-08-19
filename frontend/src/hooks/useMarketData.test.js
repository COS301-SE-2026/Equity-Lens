import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock('../services/marketDataService', () => ({
    getStockDetails: vi.fn(),
    getHistorialData: vi.fn(),
    searchStocks: vi.fn(),
}))
import { getHistorialData, getStockDetails, searchStocks } from "../services/marketDataService";

import { useMarketData } from './useMarketData'
describe('useMarketData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches stock details', async () => {
        getStockDetails.mockResolvedValueOnce({ ticker: 'AAPL', price: 123 });
        const { result } = renderHook(() => useMarketData());
        await act(async () => {
            await result.current.fetchStockDetails('AAPL');
        });
        expect(result.current.stockDetails).toEqual({ ticker: 'AAPL', price: 123 });
    });

    it('fetches historical stock data', async () => {
        getHistorialData.mockResolvedValueOnce({ symbol: 'AAPL' });
        const { result } = renderHook(() => useMarketData());
        await act(async () => {
            await result.current.fetchHistoricalData('AAPL', '1m');
        });
        expect(result.current.history).toEqual({ symbol: 'AAPL' });
    });

    it('fetches search results', async () => {
        searchStocks.mockResolvedValueOnce({ results: ['AAPL'] });
        const { result } = renderHook(() => useMarketData());
        await act(async () => {
            await result.current.fetchSearchResults('apple');
        });
        expect(result.current.searchResults).toEqual({ results: ['AAPL'] });
    });

    it('records an error on failure', async () =>{
        getStockDetails.mockRejectedValueOnce(new Error('Service failed'));
        const {result} = renderHook(() => useMarketData());
        await act(async() => {
            await expect(result.current.fetchStockDetails('AAPL')).rejects.toThrow('Service failed');
        });
        expect(result.current.error).toBe('Service failed');
    });
});