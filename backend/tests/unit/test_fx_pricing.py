from types import SimpleNamespace

from app.services import portfolio_service
from app.services.instruments import (
    KIND_STOCK,
    REGION_SA,
    REGION_UNKNOWN,
    REGION_US,
    Instrument,
    quote_currency,
)

RATE = 18.50


def _holding(**overrides):
    defaults = {
        "ticker": "MTN.JO", "instrument_name": "MTN Group", "sector": "Communication Services",
        "quantity": 2, "total_cost": 1000.0, "cost_price": 500.0, "weight_percentage": 100.0,
    }
    return SimpleNamespace(**{**defaults, **overrides})


def _quote(price, change=1.5):
    return SimpleNamespace(price=price, change_percent=change)


def _stub_price(monkeypatch, price, change=1.5):
    monkeypatch.setattr(
        portfolio_service, "get_current_price", lambda *_args: _quote(price, change)
    )


def _as_us_stock(monkeypatch, ticker="AAPL"):
    instrument = Instrument(
        ticker=ticker, sector="Technology", kind=KIND_STOCK, region=REGION_US,
        display_name="Apple Inc",
    )
    monkeypatch.setattr(
        portfolio_service, "resolve_known_instrument", lambda _name: instrument
    )


def test_quote_currency_reads_the_listing_before_the_region():
    assert quote_currency("STX500.JO", REGION_US) == "ZAR"
    assert quote_currency("MTN.JO", REGION_SA) == "ZAR"
    assert quote_currency("AAPL", REGION_US) == "USD"
    assert quote_currency("AAPL", REGION_UNKNOWN) is None
    assert quote_currency(None, REGION_UNKNOWN) is None


def test_a_jse_holding_is_priced_in_rand_with_no_conversion(monkeypatch):
    _stub_price(monkeypatch, 500.0)

    priced = portfolio_service._price_holding(_holding(), usd_zar=RATE)

    assert priced["quote_currency"] == "ZAR"
    assert priced["fx_rate"] is None
    assert priced["daily_change_is_local"] is False
    assert priced["current_price"] == 500.0


def test_a_us_holding_is_converted_to_rand_at_the_supplied_rate(monkeypatch):
    _as_us_stock(monkeypatch)
    _stub_price(monkeypatch, 230.0, change=1.5)

    priced = portfolio_service._price_holding(_holding(ticker="AAPL"), usd_zar=RATE)

    assert priced["current_price"] == 4255.00
    assert priced["value"] == 8510.00
    assert priced["priced_live"] is True
    assert priced["fx_rate"] == RATE
    assert priced["quote_currency"] == "USD"
    assert priced["daily_change_is_local"] is True
    assert priced["daily_change_pct"] == 1.5


def test_a_us_holding_with_no_rate_stays_unpriced_rather_than_counting_dollars_as_rand(
    monkeypatch,
):
    _as_us_stock(monkeypatch)
    _stub_price(monkeypatch, 230.0)

    priced = portfolio_service._price_holding(_holding(ticker="AAPL"), usd_zar=None)

    assert priced["priced_live"] is False
    assert priced["fx_rate"] is None
    assert priced["daily_change_pct"] is None
    assert priced["price_source"] == "cost"
    assert priced["value"] == 1000.0


def test_an_unclassified_holding_is_never_priced_live(monkeypatch):
    _stub_price(monkeypatch, 230.0)

    priced = portfolio_service._price_holding(
        _holding(ticker="AAPL", instrument_name="Apple Inc"), usd_zar=RATE
    )

    assert priced["region"] == REGION_UNKNOWN
    assert priced["quote_currency"] is None
    assert priced["priced_live"] is False
    assert priced["daily_change_is_local"] is False


def test_a_jse_listed_us_etf_is_not_converted(monkeypatch):
    _stub_price(monkeypatch, 120.0)

    priced = portfolio_service._price_holding(
        _holding(ticker="STX500.JO", instrument_name="Satrix S&P 500 ETF"), usd_zar=RATE
    )

    assert priced["region"] == REGION_US
    assert priced["quote_currency"] == "ZAR"
    assert priced["fx_rate"] is None
    assert priced["current_price"] == 120.0


def test_the_rate_is_read_once_for_the_whole_book(monkeypatch):
    calls = []
    monkeypatch.setattr(
        portfolio_service, "_latest_usd_zar", lambda db=None: calls.append(db) or RATE
    )
    _stub_price(monkeypatch, 500.0)

    portfolio_service._price_holdings(
        [_holding(ticker="AAPL"), _holding(), _holding(ticker="SBK.JO")]
    )

    assert len(calls) == 1


def test_an_all_jse_book_does_not_look_the_rate_up_at_all(monkeypatch):
    calls = []
    monkeypatch.setattr(
        portfolio_service, "_latest_usd_zar", lambda db=None: calls.append(db) or RATE
    )
    _stub_price(monkeypatch, 500.0)

    portfolio_service._price_holdings([_holding(), _holding(ticker="SBK.JO")])

    assert calls == []
