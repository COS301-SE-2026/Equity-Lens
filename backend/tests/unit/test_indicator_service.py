from unittest.mock import patch
from app.services.indicator_service import serialize_indicator_row, serialize_indicator_value, build_live_indicator_row
import pandas as pd

FUND_REASON = "N/A - financial instrument doesn't report company-level financials."
SECTOR_REASON= "N/A - Altman Z Score not meaningful for banks and financial institutions."

def test_serialize_indicator_value_marks_missing_data():
    result = serialize_indicator_value(None, "%")

    assert result["status"] == "insufficient_data"
    assert result["reason"] == "Data could not be retrieved."

def test_serialize_indicator_value_passes_through_status_dict():
    pre_built = {"status": "insufficient_data", "reason": FUND_REASON}
    result = serialize_indicator_value(pre_built, "x")

    assert result is pre_built

def test_serialize_indicator_row_wraps_values_for_ui():
    row = serialize_indicator_row(
        {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "capm": 20,
            "pe_ratio": 15.2,
            "altman_z": 3.1,
            "beta": 1.2,
            "rsi": 62,
            "sharpe": 0.9,
            "sortino": 1.1,
        }
    )

    assert row["ticker"] == "AAPL"
    assert row["name"] == "Apple Inc."
    assert row["capm"] == {"status": "ok", "value": 20, "unit": "%"}
    assert row["pe_ratio"] == {"status": "ok", "value": 15.2, "unit": "x"}
    assert row["altman_z"] == {"status": "ok", "value": 3.1, "unit": ""}
    assert row["beta"] == {"status": "ok", "value": 1.2, "unit": ""}
    assert row["rsi"] == {"status": "ok", "value": 62, "unit": ""}
    assert row["sharpe"] == {"status": "ok", "value": 0.9, "unit": ""}
    assert row["sortino"] == {"status": "ok", "value": 1.1, "unit": ""}

def test_serialize_indicator_row_preserves_errors():
    row = serialize_indicator_row(
        {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "error": "cache unavailable",
        }
    )

    assert row["error"] == "cache unavailable"
    assert row["capm"] == {"status": "error"}
    assert row["beta"] == {"status": "error"}

def test_serialize_indicator_row_preserves_live_fetch_flag():
    row = serialize_indicator_row({"ticker": "AAPL", "name": "Apple Inc.", "live_fetch": True})
    assert row["live_fetch"] is True

def test_serialize_indicator_row_defaults_live_fetch_to_false():
    row = serialize_indicator_row({"ticker": "AAPL", "name": "Apple Inc."})
    assert row["live_fetch"] is False

def _price_history():
    dates = pd.date_range("2025-08-01", periods=252)
    closes = [100.0 + i * 0.1 for i in range(252)]
    return pd.DataFrame(
        {"Open": closes, "High": closes, "Low": closes, "Close": closes, "Volume": [1000] * 252},
        index=dates,
    )

def _market_returns():
    dates = pd.bdate_range("2025-08-01", periods=252)
    return pd.Series([0.001] * 252, index=dates)

def test_pe_ratio_uses_direct_calculation_for_positive_eps():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"trailingEps": 5.0, "quoteType": "EQUITY"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
         }), \
         patch("app.services.indicator_service.calculate_pe_ratio", return_value=12.0):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())
 
    assert row["pe_ratio"] == 12.0
 
def test_pe_ratio_falls_back_to_trailing_pe_for_negative_eps():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"trailingEps": -3.5, "trailingPE": None, "forwardPE": 18.0, "quoteType": "EQUITY"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
         }):
        row = build_live_indicator_row("XYZ", "Loss-making Co", _market_returns())
 
    assert row["pe_ratio"] == 18.0
 
def test_pe_ratio_marked_not_applicable_for_etf():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"quoteType": "ETF"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
         }):
        row = build_live_indicator_row("VT", "Vanguard Total World", _market_returns())
 
    assert row["pe_ratio"] == {"status": "insufficient_data", "reason": FUND_REASON}
 
def test_altman_z_computed_when_all_seven_inputs_present():
    balance_sheet = pd.DataFrame({"2026-03-31": {
        "Working Capital": 100.0,
        "Total Assets": 500.0,
        "Retained Earnings": 80.0,
        "Total Liabilities Net Minority Interest": 200.0,
    }})
    financials = pd.DataFrame({"2026-03-31": {"EBIT": 60.0, "Total Revenue": 300.0}})
 
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"marketCap": 1000.0, "quoteType": "EQUITY", "sector": "Technology"},
             "balance_sheet": balance_sheet,
             "financials": financials,
         }), \
         patch("app.services.indicator_service.calculate_altman_zscore", return_value=3.2):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())
 
    assert row["altman_z"] == 3.2
 
def test_altman_z_stays_none_when_total_revenue_missing():
    balance_sheet = pd.DataFrame({"2026-03-31": {
        "Working Capital": 100.0,
        "Total Assets": 500.0,
        "Retained Earnings": 80.0,
        "Total Liabilities Net Minority Interest": 200.0,
    }})
    financials = pd.DataFrame({"2026-03-31": {"EBIT": 60.0}})
 
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"marketCap": 1000.0, "quoteType": "EQUITY", "sector": "Technology"},
             "balance_sheet": balance_sheet,
             "financials": financials,
         }):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())
 
    assert row["altman_z"] is None
 
def test_altman_z_marked_not_applicable_for_bank():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"quoteType": "EQUITY", "sector": "Financial Services", "trailingEps": 12.0},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
         }), \
         patch("app.services.indicator_service.calculate_pe_ratio", return_value=8.5):
        row = build_live_indicator_row("ABG", "Absa Group", _market_returns())
 
    assert row["altman_z"] == {"status": "insufficient_data", "reason": SECTOR_REASON}
    assert row["pe_ratio"] == 8.5
 
def test_beta_failure_does_not_wipe_out_the_rest_of_the_row():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"trailingEps": 5.0, "quoteType": "EQUITY"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
         }), \
         patch("app.services.indicator_service.calculate_beta", side_effect=ValueError("bad input")), \
         patch("app.services.indicator_service.calculate_pe_ratio", return_value=12.0):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())
 
    assert row["beta"] is None
    assert "error" not in row
    assert row["pe_ratio"] == 12.0
 
def test_no_price_data_produces_whole_row_error():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=pd.DataFrame()):
        row = build_live_indicator_row("DELISTED", "Delisted Co", _market_returns())
 
    assert row["error"] == "No price data"
    assert row["pe_ratio"] is None
    assert row["beta"] is None

def test_live_fetch_true_when_served_live():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"trailingEps": 5.0, "quoteType": "EQUITY"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
             "live_fetch": True,
         }), \
         patch("app.services.indicator_service.calculate_pe_ratio", return_value=12.0):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())

    assert row["live_fetch"] is True

def test_live_fetch_false_when_cached():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"trailingEps": 5.0, "quoteType": "EQUITY"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
             "live_fetch": False,
         }), \
         patch("app.services.indicator_service.calculate_pe_ratio", return_value=12.0):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())

    assert row["live_fetch"] is False

def test_live_fetch_defaults_false_when_missing():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=_price_history()), \
         patch("app.services.indicator_service.get_cached_fundamentals", return_value={
             "info": {"trailingEps": 5.0, "quoteType": "EQUITY"},
             "balance_sheet": pd.DataFrame(),
             "financials": pd.DataFrame(),
         }), \
         patch("app.services.indicator_service.calculate_pe_ratio", return_value=12.0):
        row = build_live_indicator_row("XYZ", "Widget Co", _market_returns())

    assert row["live_fetch"] is False

def test_live_fetch_false_when_no_price_data():
    with patch("app.services.indicator_service.get_cached_price_history", return_value=pd.DataFrame()):
        row = build_live_indicator_row("DELISTED", "Delisted Co", _market_returns())

    assert row["live_fetch"] is False
        
