from datetime import date
from unittest.mock import patch
import pytest
import pandas as pd
from app.models.portfolio import Holdings, Portfolios

NASPERS = "Naspers Limited"
TICKER_VALUES = {
    "NPN.JO": [40000, 41000, 43000, 40000, 50000],
    "^J203.JO": [80000, 81000, 82000, 80000, 88000]
}
DAYS = [date(2026, 7, day) for day in (2,3,6,7,8)]


def frame_data_builder(close):
    data = pd.DataFrame(
        {"Close": close, "Volume": [100]*len(close)}, 
        index = pd.DatetimeIndex([pd.Timestamp(day) for day in DAYS], name = "Date")
    )
    data["Prev Close"] = data["Close"].shift(1)

    return data


@pytest.fixture()
def stub_data():
    history = {}
    for ticker, closed_values in TICKER_VALUES.items():
        history[ticker] = frame_data_builder(closed_values)

    def mock_history(ticker, period = "1y"):
        return history.get(ticker.upper(), pd.DataFrame())

    with(patch("app.services.market_data_service.get_cached_price_history", mock_history),
         patch("app.services.portfolio_service.get_cached_price_history", mock_history)
        ):yield

@pytest.fixture
def importe_portfolio(db_session, test_user):
    portfolio = Portfolios( user_id = test_user.id, account_number = "EE-123456", portfolio_name = "EasyEquities ZAR", currency = "ZAR")

    db_session.add(portfolio)
    db_session.commit()

    db_session.add(Holdings(portfolio_id = portfolio.id,
                            instrument_name = NASPERS,
                            ticker = "NPN.JO",
                            sector = "Technology",
                            quantity = 10,
                            total_cost = 4000,
                            cost_price = 400,
                            weight_percentage = 100,
                    )
    )
    db_session.commit()


def test_import_to_dashboard(client, auth_headers, importe_portfolio, stub_data):
    response = client.get("/api/portfolio", headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["summary"] == {
        "total_value": 5000.00,
        "total_cost": 4000.00,
        "total_gain_loss": 1000.00,
        "total_gain_loss_pct": 25.00,
        "num_holdings": 1,
        "daily_change_pct": 25.00,
        "daily_change_value": 1250.0,
    }

    naspers = body["holdings"][0]
    assert naspers["priced_live"] is True
    assert naspers["current_price"] == 500.00
    assert naspers["value"] == 5000.00
    assert naspers["gain_loss_pct"] == 25.00
    assert (naspers["kind"], naspers["region"]) == ("stock", "South Africa")

    assert body["sectorAllocation"] == [
        {"sector": "Technology", "value": 5000.00, "percentage": 100.00},
    ]

    returns = body["returns"]
    assert returns["portfolio_value"] == 5000.00
    assert returns["invested_capital"] == 4000.00
    assert returns["simple_return_pct"] == 25.00
    assert returns["net_contributions"] == 0.0
    assert returns["time_weighted_return_pct"] is None  
    assert returns["money_weighted_return_pct"] is None 
    assert returns["holdings_count"] == 1
    assert returns["priced_live_count"] == 1

    health = body["health"]
    assert health["score"] is not None
    by_key = {s["key"]: s for s in health["subscores"]}
    assert by_key["sectorConcentration"]["value"] < 2
    assert by_key["singleStockRisk"]["value"] < 2
    assert by_key["portfolioBreadth"]["value"] < 3

    assert body["accountType"] is None
    assert body["cgt"]["available"] is False
    assert body["cgt"]["reason"] == "account_type_unknown"


def test_tagging_a_portfolio_tfsa_suppresses_the_cgt_estimate(client, auth_headers, importe_portfolio, stub_data):
    patch_response = client.patch("/api/portfolio/account-type", json={"account_type": "tfsa"}, headers=auth_headers)
    assert patch_response.status_code == 200
    assert patch_response.json()["account_type"] == "tfsa"

    response = client.get("/api/portfolio", headers=auth_headers)
    body = response.json()

    assert body["accountType"] == "tfsa"
    assert body["cgt"]["available"] is False
    assert body["cgt"]["reason"] == "tfsa_exempt"


def test_tagging_a_portfolio_zar_with_a_priced_gain_produces_a_real_estimate(
    client, auth_headers, importe_portfolio, stub_data
):
    patch_response = client.patch("/api/portfolio/account-type", json={"account_type": "zar"}, headers=auth_headers)
    assert patch_response.status_code == 200

    response = client.get("/api/portfolio", headers=auth_headers)
    body = response.json()

    cgt = body["cgt"]
    assert cgt["available"] is True
    assert cgt["net_unrealised_gain"] == pytest.approx(1000.0)
    assert cgt["taxable_capital_gain"] == 0.0
    assert cgt["holdings_from_statement_only"] == ["NPN.JO"]


def test_rejects_an_unknown_account_type(client, auth_headers, importe_portfolio):
    response = client.patch("/api/portfolio/account-type", json={"account_type": "crypto_wallet"}, headers=auth_headers)
    assert response.status_code == 422
