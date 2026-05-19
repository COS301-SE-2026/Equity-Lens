"Calculates Price to Earning ratio"
"eps: Earnings per share"
def calculate_pe_ratio(stock_price,eps):
    if eps <= 0:
        return float('nan') #Negative earnings = Useless
    return stock_price / eps


