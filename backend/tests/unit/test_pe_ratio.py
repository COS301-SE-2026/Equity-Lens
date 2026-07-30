from app.indicators.pe_ratio import calculate_pe_ratio
import math

def test_pe_ratio_returnsfloat():
    ratio = calculate_pe_ratio(
        stock_price=100,
        eps=5
    )

    assert isinstance(ratio, float)

def test_pe_ratio_computes_correct_value():
    ratio = calculate_pe_ratio(stock_price=100, eps=5)

    assert ratio == 20.0

def test_pe_ratio_zero_eps_returns_nan():
    ratio = calculate_pe_ratio(stock_price=100, eps=0)

    assert math.isnan(ratio)

def test_pe_ratio_negative_eps_returns_nan():
    ratio = calculate_pe_ratio(stock_price=100, eps=-5)

    assert math.isnan(ratio)