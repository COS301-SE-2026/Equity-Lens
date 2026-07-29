import api from './api';

export const getWatchlist = () => 
  api.get('/watchlist').then((res) => res.data);
/**
 * 
 * @param {*} ticker
 */

export const addToWatchlist = (ticker) =>
   api.post('/watchlist', { ticker }).then((res) => res.data);


/**
 * 
 * @param {*} watchlistId
 */
export const removeFromWatchlist = (watchlistId) =>
   api.delete(`/watchlist/${watchlistId}`).then((res) => res.data);