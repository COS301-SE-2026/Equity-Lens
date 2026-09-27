import api from './api';

export const getWatchlist = () => api.get('/watchlist').then((res) => res.data);

/**@param {any}  ticker*/
export const addToWatchlist = (ticker) =>
  api.post('/watchlist', { ticker }).then((res) => res.data);

/**@param {any}  watchlistId*/
export const removeFromWatchlist = (watchlistId) =>
  api.delete(`/watchlist/${watchlistId}`).then((res) => res.data);
