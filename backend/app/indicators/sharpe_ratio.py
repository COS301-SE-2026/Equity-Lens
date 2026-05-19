import numpy as np

"Calculates annualised sharpe ratio & assunes 252 trading days"

def calculate_sharpe_ratio(returns, risk_free_rate = 0.04):
    mean_daily_return = np.mean(returns)
    daily_volatility = np.std(returns)

    #Annualise
    annualised_return  = mean_daily_return * 252
    annualised_volatility = daily_volatility * np.sqrt(252)

    return (annualised_return - risk_free_rate) / annualised_volatility