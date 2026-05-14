import api from './api';

export const getPortfolio = async () => {
  const response = await api.get('/api/portfolio');
  return response.data;
};

export const getPortfolioSummary = async () => {
  const response = await api.get('/api/portfolio/summary');
  return response.data;
};

export const getSectorAllocation = async () => {
  const response = await api.get('/api/portfolio/sectors');
  return response.data;
};

export const getPerformanceHistory = async () => {
  const response = await api.get('/api/portfolio/performance');
  return response.data;
};

// Mock data for demo purposes when backend is not connected
export const getMockPortfolioData = () => ({
  summary: {
    totalValue: 125430.50,
    totalCost: 98200.00,
    totalGain: 27230.50,
    totalGainPercent: 27.73,
    holdingsCount: 8,
  },
  holdings: [
    { ticker: 'NPN', name: 'Naspers', quantity: 10, purchasePrice: 2800, currentPrice: 3150, value: 31500, gain: 3500, gainPercent: 12.5, sector: 'Technology' },
    { ticker: 'MTN', name: 'MTN Group', quantity: 50, purchasePrice: 120, currentPrice: 138, value: 6900, gain: 900, gainPercent: 15.0, sector: 'Telecommunications' },
    { ticker: 'SOL', name: 'Sasol', quantity: 30, purchasePrice: 280, currentPrice: 245, value: 7350, gain: -1050, gainPercent: -12.5, sector: 'Energy' },
    { ticker: 'FSR', name: 'Firstrand', quantity: 100, purchasePrice: 65, currentPrice: 72, value: 7200, gain: 700, gainPercent: 10.77, sector: 'Financials' },
    { ticker: 'AGL', name: 'Anglo American', quantity: 20, purchasePrice: 550, currentPrice: 620, value: 12400, gain: 1400, gainPercent: 12.73, sector: 'Mining' },
    { ticker: 'SBK', name: 'Standard Bank', quantity: 80, purchasePrice: 155, currentPrice: 178, value: 14240, gain: 1840, gainPercent: 14.84, sector: 'Financials' },
    { ticker: 'BHP', name: 'BHP Group', quantity: 15, purchasePrice: 480, currentPrice: 510, value: 7650, gain: 450, gainPercent: 6.25, sector: 'Mining' },
    { ticker: 'REM', name: 'Remgro', quantity: 40, purchasePrice: 130, currentPrice: 145, value: 5800, gain: 600, gainPercent: 11.54, sector: 'Financials' },
  ],
  sectorAllocation: [
    { sector: 'Technology', value: 31500, percentage: 25.1 },
    { sector: 'Financials', value: 27240, percentage: 21.7 },
    { sector: 'Mining', value: 20050, percentage: 16.0 },
    { sector: 'Telecommunications', value: 6900, percentage: 5.5 },
    { sector: 'Energy', value: 7350, percentage: 5.9 },
  ],
  performanceHistory: [
    { date: '2024-01', value: 98200 },
    { date: '2024-02', value: 102500 },
    { date: '2024-03', value: 99800 },
    { date: '2024-04', value: 105200 },
    { date: '2024-05', value: 108900 },
    { date: '2024-06', value: 112300 },
    { date: '2024-07', value: 110800 },
    { date: '2024-08', value: 115600 },
    { date: '2024-09', value: 119200 },
    { date: '2024-10', value: 121800 },
    { date: '2024-11', value: 123400 },
    { date: '2024-12', value: 125430 },
  ],
});