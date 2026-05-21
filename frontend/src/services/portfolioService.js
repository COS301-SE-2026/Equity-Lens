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
    { ticker: 'NPN', name: 'Naspers', sector: 'Technology', quantity: 10, avg_price: 2800, current_price: 3150, value: 31500, gain_loss: 3500, gain_loss_pct: 12.5,  daily_change_pct:  1.4  },
    { ticker: 'MTN', name: 'MTN Group', sector: 'Telecommunications', quantity: 50, avg_price: 120, current_price: 138, value: 6900, gain_loss: 900, gain_loss_pct: 15.0,  daily_change_pct: -0.8  },
    { ticker: 'SOL', name: 'Sasol', sector: 'Energy', quantity: 30, avg_price: 280, current_price: 245, value: 7350, gain_loss: -1050, gain_loss_pct: -12.5, daily_change_pct: -2.1  },
    { ticker: 'FSR', name: 'Firstrand', sector: 'Financials', quantity: 100, avg_price: 65, current_price: 72, value: 7200, gain_loss: 700, gain_loss_pct: 10.77, daily_change_pct:  0.6  },
    { ticker: 'AGL', name: 'Anglo American', sector: 'Mining', quantity: 20,  avg_price: 550, current_price: 620, value: 12400, gain_loss: 1400, gain_loss_pct: 12.73, daily_change_pct:  0.9  },
    { ticker: 'SBK', name: 'Standard Bank', sector: 'Financials', quantity: 80,  avg_price: 155, current_price: 178, value: 14240, gain_loss: 1840, gain_loss_pct: 14.84, daily_change_pct:  1.1  },
    { ticker: 'BHP', name: 'BHP Group', sector: 'Mining', quantity: 15, avg_price: 480, current_price: 510, value: 7650, gain_loss: 450, gain_loss_pct: 6.25, daily_change_pct:  0.3  },
    { ticker: 'REM', name: 'Remgro', sector: 'Financials', quantity: 40, avg_price: 130, current_price: 145, value: 5800, gain_loss: 600, gain_loss_pct: 11.54, daily_change_pct: -0.4  },
  ],
  sectorAllocation: [
    { sector: 'Technology', value: 31500, percentage: 25.1 },
    { sector: 'Financials', value: 27240, percentage: 21.7 },
    { sector: 'Mining', value: 20050, percentage: 16.0 },
    { sector: 'Telecommunications', value: 6900, percentage: 5.5 },
    { sector: 'Energy', value: 7350, percentage: 5.9 },
  ],
  performanceHistory: [
    { name: 'Jan', value: 98200,  benchmark: 72000 },
    { name: 'Feb', value: 102500, benchmark: 73000 },
    { name: 'Mar', value: 99800,  benchmark: 73500 },
    { name: 'Apr', value: 105200, benchmark: 75000 },
    { name: 'May', value: 108900, benchmark: 74500 },
    { name: 'Jun', value: 112300, benchmark: 77000 },
    { name: 'Jul', value: 110800, benchmark: 78500 },
    { name: 'Aug', value: 115600, benchmark: 80000 },
    { name: 'Sep', value: 119200, benchmark: 78000 },
    { name: 'Oct', value: 121800, benchmark: 81000 },
    { name: 'Nov', value: 123400, benchmark: 83000 },
    { name: 'Dec', value: 125430, benchmark: 85000 },
  ],
});