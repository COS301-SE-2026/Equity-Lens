import time
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import func, select

from app.config import settings
from app.models.news_event import NewsArticle, NewsArticleTicker, NewsFetchLog
from app.models.portfolio import Holdings, Portfolios, Watchlist
from app.routers import news
from app.services import ai_service
from app.services.ai_service import get_market_news_tool
from app.services.watchlist import get_watchlist_service
from app.utils import stock_cache

NEWSDATA_RESULTS = [
    {
        "title": "Rand firms as rates hold",
        "description": "Markets steady.",
        "source_name": "Moneyweb",
        "pubDate": "2026-10-15 08:00:00",
        "image_url": "https://img.example/1.jpg",
        "link": "https://news.example/1",
    }
]


def newsdata_response(results):
    response = MagicMock()
    response.json.return_value = {"status": "success", "results": results}
    return response

SNAPSHOT_SECTIONS = {
    "get_summary_import_PDF": {},
    "get_the_top_holdings_import_PDF": [],
    "get_the_top_allocation_import_PDF": [],
    "get_the_lowest_holdings_import_PDF": {},
    "get_trading_activity_import_PDF": [],
    "get_cash_flow_import_PDF": [],
    "get_dividend_income_import_PDF": [],
    "get_portfolio_analytics": {},
}


def marketaux_response(articles):
    response = MagicMock()
    response.ok = True
    response.json.return_value = {"data": articles}
    return response


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "newsdata_api_key", "placeholder-newsdata-key")
    monkeypatch.setattr(settings, "market_api_key", "placeholder-marketaux-key")


@pytest.fixture(autouse=True)
def _closed_breaker():
    news.reset_circuit_breaker()
    yield
    news.reset_circuit_breaker()


def _stored_article(db, ticker, title, days_ago=1):
    article = NewsArticle(
        external_id=f"{ticker}-{title}",
        source="marketaux",
        title=title,
        description=f"{title} in detail",
        url=f"https://news.example/{ticker}",
        image_url=None,
        source_name="Business Day",
        published_at=datetime.now(UTC) - timedelta(days=days_ago),
    )
    db.add(article)
    db.flush()
    db.add(NewsArticleTicker(article_id=article.id, ticker=ticker))
    db.commit()
    return article

@pytest.mark.usefixtures("keys")
def test_the_snapshot_preview_reads_stored_news_and_caches_market_news(
    client, db_session, test_user, auth_headers
):
    portfolio = Portfolios(user_id=test_user.id, portfolio_name="Growth", account_number="A1")
    db_session.add(portfolio)
    db_session.flush()
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Naspers Limited", ticker="NPN.JO",
        sector="Technology", quantity=10, total_cost=1000, cost_price=100, weight_percentage=100,
    ))
    db_session.commit()
    portfolio_id = portfolio.id
    _stored_article(db_session, "NPN.JO", "Naspers results")

    with patch("app.routers.news.fetch_ticker_news", side_effect=AssertionError("marketaux")), \
         patch("app.routers.news.requests.get",
               return_value=newsdata_response(NEWSDATA_RESULTS)) as provider, \
         patch.multiple(
             "app.routers.portfolio_snapshot",
             **{name: MagicMock(return_value=value) for name, value in SNAPSHOT_SECTIONS.items()},
         ), \
         patch("app.routers.portfolio_snapshot.PortfolioService.get_dashboard", return_value=None):
        previews = [
            client.get(f"/api/portfolio_snapshot/{portfolio_id}", headers=auth_headers)
            for _ in range(3)
        ]

    assert [p.status_code for p in previews] == [200, 200, 200]
    assert provider.call_count == 1
    snapshot_news = previews[-1].json()["snapshot"]["news"]
    assert snapshot_news["portfolio"] == [
        {
            "ticker": "NPN.JO",
            "title": "Naspers results",
            "description": "Naspers results in detail",
            "source": "Business Day",
            "published_at": snapshot_news["portfolio"][0]["published_at"],
            "image_url": None,
            "url": "https://news.example/NPN.JO",
        }
    ]
    assert snapshot_news["market"][0]["title"] == "Rand firms as rates hold"
    assert snapshot_news["market"][0]["source"] == "Moneyweb"

@pytest.mark.usefixtures("keys")
def test_category_news_is_served_from_cache_within_the_ttl(client, auth_headers):
    with patch("app.routers.news.requests.get",
               return_value=newsdata_response(NEWSDATA_RESULTS)) as provider:
        first = client.get("/api/news/?category=business", headers=auth_headers)
        second = client.get("/api/news/?category=Business", headers=auth_headers)

    assert first.json() == second.json()
    assert first.json()["total_articles"] == 1
    assert provider.call_count == 1


@pytest.mark.usefixtures("keys")
def test_category_news_goes_back_to_the_provider_after_the_ttl(client, auth_headers):
    with patch("app.routers.news.requests.get",
               return_value=newsdata_response(NEWSDATA_RESULTS)) as provider:
        client.get("/api/news/?category=top", headers=auth_headers)
        with patch("app.routers.news.time.monotonic", return_value=time.monotonic() + 901):
            client.get("/api/news/?category=top", headers=auth_headers)

    assert provider.call_count == 2


@pytest.mark.usefixtures("keys")
def test_an_unknown_category_is_refused_without_a_provider_call(client, auth_headers):
    with patch("app.routers.news.requests.get") as provider:
        response = client.get("/api/news/?category=anything-at-all", headers=auth_headers)

    assert response.status_code == 400
    provider.assert_not_called()


@pytest.mark.usefixtures("keys")
def test_an_empty_answer_is_not_cached(client, auth_headers):
    with patch("app.routers.news.requests.get", return_value=newsdata_response([])) as provider:
        client.get("/api/news/all", headers=auth_headers)
        client.get("/api/news/all", headers=auth_headers)

    assert provider.call_count == 2

@pytest.mark.usefixtures("keys")
def test_the_same_question_within_an_hour_costs_one_call(db_session):
    article = {"title": "JSE rallies", "source": "Reuters", "published_at": "2026-10-15"}

    with patch.object(ai_service.requests, "get",
                      return_value=marketaux_response([article])) as provider:
        first = get_market_news_tool(db_session, "Naspers")
        second = get_market_news_tool(db_session, "  naspers ")

    assert first == second
    assert "JSE rallies" in first
    assert provider.call_count == 1


@pytest.mark.usefixtures("keys")
def test_every_live_call_is_written_to_the_shared_ledger(db_session):
    with patch.object(ai_service.requests, "get", return_value=marketaux_response([])):
        get_market_news_tool(db_session, "capitec")
        get_market_news_tool(db_session, "anglo")

    rows = db_session.scalars(select(NewsFetchLog).order_by(NewsFetchLog.scope)).all()
    assert [(row.scope, row.source, row.ok) for row in rows] == [
        ("ai:anglo", "marketaux", True),
        ("ai:capitec", "marketaux", True),
    ]


@pytest.mark.usefixtures("keys")
def test_a_spent_budget_falls_back_to_saved_headlines(db_session, monkeypatch):
    monkeypatch.setattr(settings, "news_daily_request_budget", 2)
    for i in range(2):
        db_session.add(NewsFetchLog(scope=f"nightly:{i}", source="marketaux", article_count=0))
    _stored_article(db_session, "SBK.JO", "Standard Bank lifts dividend")
    _stored_article(db_session, "MTN.JO", "MTN expands fibre")
    _stored_article(db_session, "SBK.JO", "Standard Bank old story", days_ago=30)

    with patch.object(ai_service.requests, "get", side_effect=AssertionError("marketaux")):
        reply = get_market_news_tool(db_session, "standard bank")

    assert reply.startswith("Live news is paused for today, so these are saved headlines:")
    assert "Standard Bank lifts dividend" in reply
    assert "MTN expands fibre" not in reply
    assert "old story" not in reply


@pytest.mark.usefixtures("keys")
def test_an_open_breaker_also_falls_back(db_session, monkeypatch):
    _stored_article(db_session, "NPN.JO", "Naspers results")
    monkeypatch.setattr(news, "_breaker_open_until", time.monotonic() + 600)

    with patch.object(ai_service.requests, "get", side_effect=AssertionError("marketaux")):
        reply = get_market_news_tool(db_session, "")

    assert "Naspers results" in reply
    assert db_session.scalar(select(func.count(NewsFetchLog.id))) == 0

def _watchlist(db_session, user, tickers):
    for ticker in tickers:
        db_session.add(Watchlist(user_id=user.id, ticker=ticker))
    db_session.commit()


def test_listing_twice_within_the_ttl_looks_each_ticker_up_once(db_session, test_user):
    _watchlist(db_session, test_user, ["AAPL", "MSFT", "NPN.JO"])

    with patch("app.services.watchlist.yf.Ticker") as ticker:
        ticker.return_value.info = {"currentPrice": 100, "regularMarketChangePercent": 1.0}
        get_watchlist_service(db_session, test_user.id)
        result = get_watchlist_service(db_session, test_user.id)

    assert ticker.call_count == 3
    assert [item["current_price"] for item in result["watchlist"]] == [100, 100, 1.0]


def test_a_cooldown_skips_yahoo_and_leaves_prices_empty(db_session, test_user):
    _watchlist(db_session, test_user, ["AAPL", "MSFT"])
    stock_cache._YFINANCE_GLOBAL_COOLDOWN_UNTIL = datetime.now(UTC) + timedelta(minutes=5)

    with patch("app.services.watchlist.yf.Ticker") as ticker:
        result = get_watchlist_service(db_session, test_user.id)

    ticker.assert_not_called()
    assert [item["current_price"] for item in result["watchlist"]] == [None, None]


def test_a_rate_limit_from_yahoo_trips_the_shared_cooldown(db_session, test_user):
    _watchlist(db_session, test_user, ["AAPL", "MSFT"])

    with patch("app.services.watchlist.yf.Ticker") as ticker:
        type(ticker.return_value).info = property(
            lambda _self: (_ for _ in ()).throw(Exception("Too Many Requests. Rate limited."))
        )
        get_watchlist_service(db_session, test_user.id)

    assert stock_cache._yfinance_globally_cooling_down()
    assert ticker.call_count == 1
