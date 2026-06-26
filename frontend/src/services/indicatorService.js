import api from './api';

export const getIndicatorData = async () => {
  const response = await api.get('/indicators');
  return response.data;
};