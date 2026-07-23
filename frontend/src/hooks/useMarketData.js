import { useCallback, useState } from "react";
import { getHistorialData, searchStocks, getStockDetails, } from '../services/marketDataService';

const useMarketData = () => {
    const [currentPrice, setCurrentPrice] = useState(null);
    const [stockDetails, setStockDetails] = useState(null);
    const [history, setHistory] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState(null);

    const runRequest = useCallback(async (request, onSuccess) => {
        setLoading(true);
        setError(null);
        try {
            const data = await request();
            onSuccess(data);
            return data;
        } catch (err) {
            setError(err?.message || "Failed to load market data");
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStockDetails = useCallback((symbol) => runRequest(() => getStockDetails(symbol), setStockDetails), [runRequest]);
    const fetchHistoricalData = useCallback((symbol, period = '1mo') => runRequest(() => getHistorialData(symbol, period), setHistory), [runRequest]);
    const fetchSearchResults = useCallback((query) => runRequest(() => searchStocks(query), setSearchResults), [runRequest]);

    const reset = useCallback(() => {
        setCurrentPrice(null);
        setStockDetails(null);
        setHistory(null);
        setSearchResults([]);
        setError(null);
        setLoading(false);
    }, []);
    return {
        stockDetails, history, searchResults, loading, error, fetchStockDetails, fetchSearchResults, fetchHistoricalData, reset,
    };
}
export {useMarketData};
