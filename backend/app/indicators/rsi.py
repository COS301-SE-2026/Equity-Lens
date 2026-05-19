import pandas as pd
"Relative Strength Index (RSI)"
"Scores price movement from 0-100 to warn when something is overbought or oversold."
def calculate_rsi(price_series, periods = 14):
    prices = pd.Series(price_series)

    delta = prices.diff()

    gain = delta.clip(lower = 0)
    loss = -delta.clip(upper = 0)
    #Wilder's Exponential Moving average
    avg_gain = gain.ewm(com=periods - 1,adjust=False).mean()
    avg_loss = loss.ewm(com=periods - 1,adjust=False).mean()

    rs = avg_gain / avg_loss
    #Convert to scale form
    rsi = 100 - (100 / (1 + rs))
    return rsi