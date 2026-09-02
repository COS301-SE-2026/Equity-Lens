import api from './api'

export const getStockDetails = async (symbol) => {
    const response = await api.get('/stocks/details', {
        params: { symbol },
    });
    return response.data;
}

export const getHistorialData = async (symbol, period = '1mo') => {
    const response = await api.get('/stocks/history', {
        params: { symbol, period },
    });
    return response.data;
}

export const searchStocks = async (query, signal) => {
    const response = await api.get('/stocks/search', {
        params: { query },
        signal,
    });
    return response.data;
}