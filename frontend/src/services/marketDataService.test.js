import { describe, expect, it, vi, beforeEach } from "vitest";

import { getStockDetails, getHistorialData, searchStocks } from "./marketDataService";

vi.mock('./api', () => ({
    default: {
        get: vi.fn(),
    },
}));

import api from './api'

describe('marketDataService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches stock details', async () => {
        api.get.mockResolvedValueOnce({data: {ticker: 'AAPL'}});
        await expect(getStockDetails('AAPL')).resolves.toEqual({ticker: 'AAPL'});
        expect(api.get).toHaveBeenCalledWith('/stocks/details', {params: {symbol: 'AAPL'}});
    });

    it('fetches historical data', async() => {
        api.get.mockResolvedValueOnce({data: {symbol: 'AAPL'}});
        await expect(getHistorialData('AAPL','1m')).resolves.toEqual({symbol: 'AAPL'});
        expect(api.get).toHaveBeenCalledWith('/stocks/history', {
            params: {symbol: 'AAPL', period: '1m'},
        });
    });

    it('searches stock', async() => {
        api.get.mockResolvedValueOnce({data: {results: [{ticker: 'AAPL', name: 'Apple Inc.'}]}});
        await expect(searchStocks('apple')).resolves.toEqual({results: [{ticker: 'AAPL',name: 'Apple Inc.'}]});
        expect (api.get).toHaveBeenCalledWith('/stocks/search', {params: {query: 'apple'}});
    });
});