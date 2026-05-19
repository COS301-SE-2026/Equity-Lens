from app.indicators.beta import calculate_beta


def test_beta_returns_a_float_Value():
    returns = [0.10, 0.05, -0.02, 0.03]
    market = [0.08, 0.04, -0.01, 0.02]

    result = calculate_beta(returns, market)

    assert isinstance(result, float)


def test_beta_always_be_postive():
    returns = [0.10, 0.05, -0.02, 0.03]
    market = [0.08, 0.04, -0.01, 0.02]

    result = calculate_beta(returns, market)

    assert result > 0


def test_beta_notequalzero():
    returns = [0.10, 0.05, -0.02, 0.03]
    market = [0.08, 0.04, -0.01, 0.02]

    result = calculate_beta(returns, market)

    assert result != 0