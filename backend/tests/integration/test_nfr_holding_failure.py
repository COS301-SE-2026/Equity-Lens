from types import SimpleNamespace

from app.services.portfolio_service import _price_holdings


def test_one_holding_market_failure_does_not_stop_others(mocker):

    holdings = [
        SimpleNamespace(
            ticker="AAPL",
            instrument_name="Apple",
            quantity=2,
            total_cost=1000,
            cost_price=500,
            sector="Technology",
        ),
        SimpleNamespace(
            ticker="MSFT",
            instrument_name="Microsoft",
            quantity=2,
            total_cost=1200,
            cost_price=600,
            sector="Technology",
        ),
        SimpleNamespace(
            ticker="GOOG",
            instrument_name="Google",
            quantity=2,
            total_cost=1400,
            cost_price=700,
            sector="Technology",
        ),
    ]

    # the gate these tickers have to get past is quote_currency now, not is_zar_listed - this
    # test is about one holding's failure not stopping the others, so the currency is forced
    # rather than worked out
    mocker.patch("app.services.portfolio_service.quote_currency", return_value="ZAR")

    def fake_price(ticker, db=None):

        if ticker == "MSFT":
            raise Exception("Market data unavailable")

        return SimpleNamespace(price=800, change_percent=1.5)

    mocker.patch("app.services.portfolio_service.get_current_price", side_effect=fake_price)

    result = _price_holdings(holdings)

    assert len(result) == 3

    msft = next(h for h in result if h["ticker"] == "MSFT")

    assert msft["priced_live"] is False

    assert next(h for h in result if h["ticker"] == "AAPL")["priced_live"] is True
    assert next(h for h in result if h["ticker"] == "GOOG")["priced_live"] is True
