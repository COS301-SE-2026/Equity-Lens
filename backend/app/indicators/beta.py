import numpy as np

"Tells you if a stock moves more or less than the market does."

def calculate_beta(stock_returns, market_returns):
    covariance_matrix = np.cov(stock_returns, market_returns)
    
    covariance = covariance_matrix[0, 1]
    
    market_variance = covariance_matrix[1, 1]
    
    return covariance / market_variance
