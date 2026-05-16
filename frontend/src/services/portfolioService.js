import api from './api';

export const getPortfolio = async () => {
  const response = await api.get('/portfolio');
  return response.data;
};

export const getPortfolioSummary = async () => {
  const response = await api.get('/portfolio/summary');
  return response.data;
};

export const getSectorAllocation = async () => {
  const response = await api.get('/portfolio/sectors');
  return response.data;
};

export const getPerformanceHistory = async () => {
  const response = await api.get('/portfolio/performance');
  return response.data;
};

export const getMockPortfolioData = () => ({
  summary: {
    total_value: 125430.50,
    total_gain_loss: 27230.50,
    total_gain_loss_pct: 27.73,
    daily_change: 2.4,
    num_holdings: 8,
  },
  holdings: [
    { ticker: 'NPN', name: 'Naspers', sector: 'Technology', quantity: 10, avg_price: 2800, current_price: 3150, value: 31500, gain_loss: 3500, gain_loss_pct: 12.5 },
    { ticker: 'MTN', name: 'MTN Group', sector: 'Telecommunications', quantity: 50, avg_price: 120, current_price: 138, value: 6900, gain_loss: 900, gain_loss_pct: 15.0 },
    { ticker: 'SOL', name: 'Sasol', sector: 'Energy', quantity: 30, avg_price: 280, current_price: 245, value: 7350, gain_loss: -1050, gain_loss_pct: -12.5 },
    { ticker: 'FSR', name: 'Firstrand', sector: 'Financials', quantity: 100, avg_price: 65, current_price: 72, value: 7200, gain_loss: 700, gain_loss_pct: 10.77 },
    { ticker: 'AGL', name: 'Anglo American', sector: 'Mining', quantity: 20, avg_price: 550, current_price: 620, value: 12400, gain_loss: 1400, gain_loss_pct: 12.73 },
    { ticker: 'SBK', name: 'Standard Bank', sector: 'Financials', quantity: 80, avg_price: 155, current_price: 178, value: 14240, gain_loss: 1840, gain_loss_pct: 14.84 },
    { ticker: 'BHP', name: 'BHP Group', sector: 'Mining', quantity: 15, avg_price: 480, current_price: 510, value: 7650, gain_loss: 450, gain_loss_pct: 6.25 },
    { ticker: 'REM', name: 'Remgro', sector: 'Financials', quantity: 40, avg_price: 130, current_price: 145, value: 5800, gain_loss: 600, gain_loss_pct: 11.54 },
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