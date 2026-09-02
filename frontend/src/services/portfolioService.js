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

export const setAccountType = async (accountType) => {
  const response = await api.patch('/portfolio/account-type', { account_type: accountType });
  return response.data;
};

export const getTaxAnalysis = async () => {
  const response = await api.get('/portfolio/tax-analysis');
  return response.data;
};

export const getTfsaRoom = async () => {
  const response = await api.get('/portfolio/tfsa-room');
  return response.data;
};


export const getMarketContext = async () => {
  const response = await api.get('/portfolio/market-context');
  return response.data;
};


export const simulateSectorInvestment = async (sector) => {
  const response = await api.post('/portfolio/simulate-sector-investment', { sector });
  return response.data;
};

export const simulateSectorRebalance = async () => {
  const response = await api.post('/portfolio/simulate-sector-rebalance');
  return response.data;
};

export const getHealthConfig = async () => {
  const response = await api.get('/portfolio/health-config');
  return response.data;
};

/** @param {{ preset_key?: string, config?: Record<string, number> }} body */
export const saveHealthConfig = async (body) => {
  const response = await api.put('/portfolio/health-config', body);
  return response.data;
};

export const clearHealthConfig = async () => {
  const response = await api.delete('/portfolio/health-config');
  return response.data;
};
