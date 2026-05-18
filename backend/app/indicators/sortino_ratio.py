import numpy as np
"Evaluates a risk-adjusted performance using downside risk"
"Assumed 252 trading days"

def calculate_sortino_ratio(stock_return, riskfree_rate = 0.04):
    annualised_return = stock_return.mean() * 252
    downside_returns = stock_return[stock_return < 0]
    downside_deviation = np.std(downside_returns) * np.sqrt(252)

    #Avoid dividing by 0
    if downside_deviation == 0:
        return np.nan
    
    return (annualised_return - riskfree_rate) / downside_deviation