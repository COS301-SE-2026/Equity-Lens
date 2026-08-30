import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPortfolio,
  getPortfolioSummary,
  getSectorAllocation,
  getPerformanceHistory,
  getMockPortfolioData,
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

  describe('getMockPortfolioData', () => {
    it('returns an object with summary', () => {
      const data = getMockPortfolioData();
      expect(data).toHaveProperty('summary');
    });

    it('returns an object with holdings array', () => {
      const data = getMockPortfolioData();
      expect(Array.isArray(data.holdings)).toBe(true);
    });

    it('returns 8 holdings', () => {
      const data = getMockPortfolioData();
      expect(data.holdings).toHaveLength(8);
    });

    it('returns holdings with required fields', () => {
      const data = getMockPortfolioData();
      const holding = data.holdings[0];
      expect(holding).toHaveProperty('ticker');
      expect(holding).toHaveProperty('name');
      expect(holding).toHaveProperty('sector');
      expect(holding).toHaveProperty('quantity');
      expect(holding).toHaveProperty('avg_price');
      expect(holding).toHaveProperty('current_price');
      expect(holding).toHaveProperty('value');
      expect(holding).toHaveProperty('gain_loss');
      expect(holding).toHaveProperty('gain_loss_pct');
    });

    it('returns sector allocation array', () => {
      const data = getMockPortfolioData();
      expect(Array.isArray(data.sectorAllocation)).toBe(true);
      expect(data.sectorAllocation.length).toBeGreaterThan(0);
    });

    it('returns performance history with 12 months', () => {
      const data = getMockPortfolioData();
      expect(data.performanceHistory).toHaveLength(12);
    });

    it('summary has correct fields', () => {
      const { summary } = getMockPortfolioData();
      expect(summary).toHaveProperty('total_value');
      expect(summary).toHaveProperty('total_gain_loss');
      expect(summary).toHaveProperty('total_gain_loss_pct');
      expect(summary).toHaveProperty('num_holdings');
    });

    it('summary total_value is a number', () => {
      const { summary } = getMockPortfolioData();
      expect(typeof summary.total_value).toBe('number');
    });

    it('NPN is the first holding', () => {
      const data = getMockPortfolioData();
      expect(data.holdings[0].ticker).toBe('NPN');
    });

    it('SOL has a negative gain_loss', () => {
      const data = getMockPortfolioData();
      const sol = data.holdings.find(h => h.ticker === 'SOL');
      expect(sol.gain_loss).toBeLessThan(0);
    });
  });
});
