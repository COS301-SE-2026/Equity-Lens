from app.indicators.sharpe_ratio import calculate_sharpe_ratio


def test_sharpe_ratio_returnsfloat():
    returns = [0.01, 0.02, -0.01, 0.015, 0.005]

    result = calculate_sharpe_ratio(returns)

    assert isinstance(result, float)