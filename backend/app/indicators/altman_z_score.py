"Calculates the Altman Z-Score"
def caclculate_altman_zscore(working_capital, total_assets, retained_earnings, ebit, market_cap, total_liabilities, sales):
    Z1 = working_capital / total_assets
    Z2 = retained_earnings / total_assets
    Z3 = ebit / total_assets
    Z4 = market_cap / total_assets
    Z5 = sales / total_assets

    z_score = (1.2 * Z1) + (1.4 * Z2) + (3.3 * Z3) + (0.6 * Z4) + (0.999 * Z5)
    return z_score
