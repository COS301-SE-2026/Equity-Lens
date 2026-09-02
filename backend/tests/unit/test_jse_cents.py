import pandas as pd
import pytest

from app.services import market_data_service


def _history(closes: list[float]) -> pd.DataFrame:
    index = pd.to_datetime([f"2026-07-{20 + i}" for i in range(len(closes))])
    return pd.DataFrame(
        {
            "Open": closes,
            "High": closes,
            "Low": closes,
            "Close": closes,
            "Volume": [100] * len(closes),
        },
        index=index,
    )


@pytest.fixture
def fake_history(monkeypatch):
    series: dict[str, pd.DataFrame] = {}

    def fake_get_cached_price_history(symbol, period="1y"):
        return series.get(symbol, pd.DataFrame())

    monkeypatch.setattr(
        market_data_service, "get_cached_price_history", fake_get_cached_price_history
    )
    return series


@pytest.mark.parametrize(
    ("symbol", "divisor"),
    [
        ("CTOP50.JO", 100.0),
        ("STXEMG.JO", 100.0),
        ("npn.jo", 100.0),
        ("^J203.JO", 1.0),
        ("MSFT", 1.0),
        ("^GSPC", 1.0),
        ("USDZAR=X", 1.0),
    ],
)
def test_cents_divisor_per_symbol(symbol, divisor):
    assert market_data_service._cents_to_major(symbol) == divisor


def test_jse_price_is_converted_from_cents(fake_history):
    fake_history["CTOP50.JO"] = _history([4600.0, 4525.0])
    quote = market_data_service.get_current_price("CTOP50.JO")
    assert quote.price == pytest.approx(45.25)


def test_fx_pair_is_not_divided(fake_history):
    fake_history["USDZAR=X"] = _history([18.40, 18.50])
    assert market_data_service.get_current_price("USDZAR=X").price == pytest.approx(18.50)


def test_jse_index_level_is_not_divided(fake_history):
    fake_history["^J203.JO"] = _history([89000.0, 90000.0])
    assert market_data_service.get_current_price("^J203.JO").price == pytest.approx(90000.0)


def test_change_percent_is_unaffected_by_the_conversion(fake_history):
    fake_history["CTOP50.JO"] = _history([4000.0, 4400.0])
    assert market_data_service.get_current_price("CTOP50.JO").change_percent == pytest.approx(10.0)


def test_history_endpoint_uses_the_same_scale(fake_history):
    fake_history["CTOP50.JO"] = _history([4600.0, 4525.0])
    history = market_data_service.get_historical_data("CTOP50.JO", "1mo")
    assert [point.close for point in history.data] == pytest.approx([46.0, 45.25])
    assert history.data[0].open == pytest.approx(46.0)
