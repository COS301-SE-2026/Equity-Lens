import api from './api'

/**
 * 
 * @param {*} symbol 
 * @returns 
 */
export const getStockDetails = async (symbol) => {
    const response = await api.get('/stocks/details', {
        params: { symbol },
    });
    return response.data;
}

/**
 * 
 * @param {*} symbol 
 * @returns 
 */
export const getHistorialData = async (symbol, period = '1mo') => {
    const response = await api.get('/stocks/history', {
        params: { symbol, period },
    });
    return response.data;
}

/**
 * 
 * @param {*} query 
 * @returns 
 */

export const searchStocks = async (query) => {
    const response = await api.get('/stocks/search', {
        params: { query },
    });
    return response.data;
}