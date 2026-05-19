from app.indicators.altman_z_score import caclculate_altman_zscore


def test_altman_zscore_returns_float():
    result = caclculate_altman_zscore(
        50000,
        200000,
        30000,
        25000,
        150000,
        100000,
        400000
    )

    assert isinstance(result, float)


def test_altman_zscore_positive():
    result = caclculate_altman_zscore(
        50000,
        200000,
        30000,
        25000,
        150000,
        100000,
        400000
    )

    assert result > 0