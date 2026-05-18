"Calculates expected return using CAPM"
"CAPM - Capital Asset Pricing Model"
def calculate_capm(risk_free_rate, beta, expected_market_return):
    market_risk_premium = expected_market_return - risk_free_rate
    return risk_free_rate + (beta * market_risk_premium)
