from app.indicators.capm import calculate_capm


def test_capm_returnsfloat():
    capm = calculate_capm(
        risk_free_rate=0.02,
        beta=1.2,
        expected_market_return=0.08
    )

    assert isinstance(capm, float)