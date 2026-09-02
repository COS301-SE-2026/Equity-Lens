import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPortfolio,
  getPortfolioSummary,
  getSectorAllocation,
  getPerformanceHistory,
} from './portfolioService';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('portfolioService', () => {

  describe('getPortfolio', () => {
    it('calls the correct endpoint', async () => {
      api.get.mockResolvedValueOnce({ data: { holdings: [] } });
      await getPortfolio();
      expect(api.get).toHaveBeenCalledWith('/portfolio');
    });

    it('returns response data', async () => {
      const mockData = { holdings: [{ ticker: 'NPN' }] };
      api.get.mockResolvedValueOnce({ data: mockData });
      const result = await getPortfolio();
      expect(result).toEqual(mockData);
    });

    it('throws when api call fails', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'));
      await expect(getPortfolio()).rejects.toThrow('Network error');
    });
  });

  describe('getPortfolioSummary', () => {
    it('calls the correct endpoint', async () => {
      api.get.mockResolvedValueOnce({ data: {} });
      await getPortfolioSummary();
      expect(api.get).toHaveBeenCalledWith('/portfolio/summary');
    });

    it('returns summary data', async () => {
      const summary = { total_value: 125000, total_gain_loss: 12500 };
      api.get.mockResolvedValueOnce({ data: summary });
      const result = await getPortfolioSummary();
      expect(result).toEqual(summary);
    });
  });

  describe('getSectorAllocation', () => {
    it('calls the correct endpoint', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getSectorAllocation();
      expect(api.get).toHaveBeenCalledWith('/portfolio/sectors');
    });

    it('returns sector data', async () => {
      const sectors = [{ sector: 'Technology', percentage: 25.1 }];
      api.get.mockResolvedValueOnce({ data: sectors });
      const result = await getSectorAllocation();
      expect(result).toEqual(sectors);
    });
  });

  describe('getPerformanceHistory', () => {
    it('calls the correct endpoint', async () => {
      api.get.mockResolvedValueOnce({ data: [] });
      await getPerformanceHistory();
      expect(api.get).toHaveBeenCalledWith('/portfolio/performance');
    });

    it('returns performance history data', async () => {
      const history = [{ date: '2024-01', value: 98200 }];
      api.get.mockResolvedValueOnce({ data: history });
      const result = await getPerformanceHistory();
      expect(result).toEqual(history);
    });
  });
});
