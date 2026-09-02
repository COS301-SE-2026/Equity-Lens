import pytest
from app.services.health_score import compute_health_score
from app.services.instruments import KIND_ETF, KIND_STOCK


def _holding(ticker, sector, value, *, kind = KIND_STOCK, priced_live = True, region = "ZA"):
    return {
        "ticker": ticker,
        "sector": sector,
        "kind": kind,
        "region": region,
        "priced_live": priced_live,
        "value": value
    }


def _sub(result, key):
  return next(s for s in result["subscores"] if s["key"] == key)


def _book_with_top(top_pct):
    chunks = [_holding(f"S{i}", f"Sector{i}", 10.0) for i in range(int((100 - top_pct) // 10))]
    return [_holding("TOP", "Technology", float(top_pct)), *chunks]


SPREAD = [
    _holding("A", "Technology", 2500),
    _holding("B", "Financials", 2500),
    _holding("C", "Healthcare", 2500),
    _holding("D", "Energy", 2500)
]

CONCENTRATED = [
    _holding("NPN.JO", "Technology", 7000),
    _holding("SOL.JO", "Energy", 2000),
    _holding("SBK.JO", "Financials", 1000)
]


def test_empty_portfolio_returns_null_score():
    assert compute_health_score([]) == {"score": None, "label": None, "subscores": []}


def test_well_spread_portfolio_scores_healthy():
    result = compute_health_score(SPREAD)
    assert result["score"] == 7.4
    assert result["label"] == "Healthy"
    assert _sub(result, "sectorConcentration")["value"] == 8.8
    assert _sub(result, "singleStockRisk")["value"] == 7.5
    assert _sub(result, "portfolioBreadth")["value"] == 5.0


def test_concentrated_portfolio_scores_poorly():
    result = compute_health_score(CONCENTRATED)
    assert result["score"] == 3.8
    assert result["label"] == "Needs attention"
    assert _sub(result, "sectorConcentration")["value"] == 5.4
    assert _sub(result, "singleStockRisk")["value"] == 3.0
    assert _sub(result, "portfolioBreadth")["value"] == 2.3


def test_score_is_the_weighted_sum_of_its_subscores():
    result = compute_health_score(CONCENTRATED)
    expected = sum(s["weight"] * s["value"] for s in result["subscores"])
    assert result["score"] == pytest.approx(expected, abs=0.05)
    assert sum(s["weight"] for s in result["subscores"]) == pytest.approx(1.0)


def test_every_subscore_carries_its_explanatory_copy():
    for sub in compute_health_score(SPREAD)["subscores"]:
        assert 0.0 <= sub["value"] <= 10.0
        assert sub["label"] and sub["detail"] and sub["target"] and sub["improvement"]


def test_subscores_clamp_at_ten_for_a_very_broad_book():
    many = [_holding(f"T{i}", f"Sector{i}", 1000) for i in range(20)]
    result = compute_health_score(many)
    assert _sub(result, "sectorConcentration")["value"] == 10.0
    assert _sub(result, "portfolioBreadth")["value"] == 10.0
    assert result["label"] == "Excellent"


def test_etf_top_holding_uses_the_fund_wording():
    book = [
        _holding("STXWDM.JO", "Global Equity", 6000, kind=KIND_ETF),
        _holding("SBK.JO", "Financials", 4000),
    ]
    sub = _sub(compute_health_score(book), "singleStockRisk")
    assert sub["label"] == "Fund Concentration"
    assert "fund, not a single company" in sub["detail"]
    assert "Global Equity" in sub["detail"]


def test_stock_top_holding_uses_the_single_stock_wording():
    sub = _sub(compute_health_score(CONCENTRATED), "singleStockRisk")
    assert sub["label"] == "Single-Stock Risk"
    assert sub["detail"].startswith("NPN.JO is 70% of your book.")


def test_top_holding_without_a_ticker_falls_back_to_a_generic_name():
    book = [_holding(None, "Technology", 5000), _holding("B", "Financials", 1000)]
    sub = _sub(compute_health_score(book), "singleStockRisk")
    assert sub["detail"].startswith("Your largest holding is")


@pytest.mark.parametrize(
    ("top_pct", "risk_word"),
    [(20, "Low"), (30, "Moderate"), (60, "High")]
)
def test_concentration_risk_word_tracks_the_configured_thresholds(top_pct, risk_word):
    sub = _sub(compute_health_score(_book_with_top(top_pct)), "singleStockRisk")
    assert f"{risk_word} concentration." in sub["detail"]


def test_low_concentration_book_gets_the_reassuring_improvement_line():
    sub = _sub(compute_health_score(_book_with_top(20)), "singleStockRisk")
    assert sub["improvement"] == "No single position is carrying outsized risk."


def test_high_concentration_book_is_told_what_to_trim():
    sub = _sub(compute_health_score(CONCENTRATED), "singleStockRisk")
    assert "Trim NPN.JO" in sub["improvement"]


def test_sector_detail_flags_holdings_priced_at_cost():
    book = [
        _holding("A", "Technology", 6000, priced_live=False),
        _holding("B", "Energy", 4000),
    ]
    sub = _sub(compute_health_score(book), "sectorConcentration")
    assert "partially stale" in sub["detail"]


def test_sector_detail_stays_clean_when_everything_is_priced_live():
    sub = _sub(compute_health_score(SPREAD), "sectorConcentration")
    assert "partially stale" not in sub["detail"]
    assert "across 4 sectors" in sub["detail"]


def test_sector_detail_is_singular_for_a_one_sector_book():
    book = [_holding("A", "Technology", 5000), _holding("B", "Technology", 5000)]
    sub = _sub(compute_health_score(book), "sectorConcentration")
    assert "across 1 sector)" in sub["detail"]
    assert "Adding exposure outside Technology" in sub["improvement"]


def test_breadth_detail_reports_effective_positions_not_a_raw_count():
    sub = _sub(compute_health_score(CONCENTRATED), "portfolioBreadth")
    assert "3 positions" in sub["detail"]
    assert "1.9 effective positions" in sub["detail"]