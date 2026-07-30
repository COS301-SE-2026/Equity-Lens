from datetime import date, timedelta
from unittest.mock import patch
import pytest
import pandas as pd

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
def importe_portfolio(client, auth_headers):
    stock = {NASPERS: {"Found": True, "ticker": "NPN.JO", "sector": "Technology"}}

    with(patch("app.services.import_pdf.search_ticket_number", stock.get)):
        document = client.post("/api/import_pdf/", json = {"file_name": "statement.pdf"}, headers = auth_headers)
        assert document.status_code == 200, document.text

        portfolio = client.post("/api/import_pdf/save_portfolios",
                    json = {
                        "document_id": document.json()["document_id"],
                        "account_number": "EE-123456",
                        "portfolio_name": "EasyEquities ZAR",
                        "currency": "ZAR"
                    }, headers = auth_headers
        )
        assert portfolio.status_code == 200, portfolio.text
        portfolio_id = portfolio.json()["portfolio_id"]

        for holding in [{
            "portfolio_id": portfolio_id,
            "instrument_name": NASPERS,
            "ticker": "",
            "quantity": "10",
            "total_cost": "4000",
            "cost_price": "400",
            "weight_percentage": "66.67",
            "sector": ""
        }]: response = client.post(
            "/api/import_pdf/save_holdings", json = holding, headers = auth_headers
        ) 
        assert response.status_code == 200, response.text


def test_import_to_dashboard(client, auth_headers, importe_portfolio, stub_data):
    response = client.get("/api/portfolio", headers=auth_headers)
    assert response.status_code == 200

    body  = response.json()
    assert body["summary"] == {
        "total_value": 5000.00,
        "total_cost": 4000.00,
        "total_gain_loss": 1000.00,
        "total_gain_loss_pct": 25.00,
        "num_holdings": 1,
        "daily_change": 25.00
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

    assert body["benchmarkLabel"] == "JSE ALSI"
    history = body["performanceHistory"]
    assert [r["date"] for r in history] == [
        "2026-07-02", "2026-07-03", "2026-07-06", "2026-07-07", "2026-07-08",
    ]
    assert [r["value"] for r in history] == [4000.0, 4100.0, 4300.0, 4000.0, 5000.0]
    assert history[-1]["value"] == body["summary"]["total_value"]
    assert history[0]["benchmark"] == pytest.approx(4000.0, abs=0.01)
    assert history[1]["benchmark"] == pytest.approx(4050.0, abs=0.01)
    assert history[2]["benchmark"] == pytest.approx(4100.0, abs=0.01)
    assert history[4]["benchmark"] == pytest.approx(4400.0, abs=0.01)
