from app.routers.indicators import serialize_indicator_row, _serialize_indicator_value


def test_serialize_indicator_value_marks_missing_data():
    result = _serialize_indicator_value(None, "%")

    assert result["status"] == "insufficient_data"
    assert result["reason"] == "No cached indicator data available."


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
