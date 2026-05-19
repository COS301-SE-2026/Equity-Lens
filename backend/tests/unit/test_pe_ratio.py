from app.indicators.pe_ratio import calculate_pe_ratio


def test_pe_ratio_returnsfloat():
    ratio = calculate_pe_ratio(
        stock_price=100,
        eps=5
    )

    assert isinstance(ratio, float)