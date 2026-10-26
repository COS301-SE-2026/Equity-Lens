import math
import threading
import time
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pandas as pd
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models.news_event import NewsFetchLog
from app.models.portfolio import Holdings, Portfolios
from app.repositories.news_repository import NewsRepository
from app.routers import news
from app.scripts import seed_news
from app.services import news_ingest, portfolio_service
from app.services.news_ingest import ProviderResult
from app.utils import ai_rate_limit
from app.utils.ai_rate_limit import check_limit

EVENT_DAY = date.today() - timedelta(days=30)
MARKET = [0.01, -0.006, 0.004, -0.002, 0.008]


@pytest.fixture(autouse=True)
def _fresh_guards():
    news.reset_circuit_breaker()
    ai_rate_limit._HITS.clear()
    news_ingest._window_locks.clear()
    yield
    news.reset_circuit_breaker()
    ai_rate_limit._HITS.clear()


@pytest.fixture
def key(monkeypatch):
    monkeypatch.setattr(settings, "market_api_key", "test-key-not-real")


def hold(db_session, user, name, ticker):
    portfolio = Portfolios(user_id=user.id, account_number="EE-1", portfolio_name="Mine")
    db_session.add(portfolio)
    db_session.commit()
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name=name, ticker=ticker, sector="Retail",
        quantity=10, cost_price=200, total_cost=2000, weight_percentage=100,
    ))
    db_session.commit()


def store_article(db_session, ticker, day, external_id="stored-1", title="Mr Price trading update"):
    NewsRepository(db_session).upsert_articles([{
        "external_id": external_id,
        "source": "marketaux",
        "title": title,
        "description": f"{title} in detail",
        "url": f"https://news.example/{external_id}",
        "image_url": None,
        "source_name": "Example",
        "published_at": datetime.combine(day - timedelta(days=1), datetime.min.time(), UTC)
        + timedelta(hours=6),
        "sentiment": "negative",
        "sentiment_score": -0.3,
        "tickers": [{"ticker": ticker, "sentiment_score": -0.3, "match_score": 30.0}],
    }])
    db_session.commit()


def marketaux_article(day):
    return {
        "uuid": "fetched-1",
        "title": "Mr Price warns on sales",
        "description": "Mr Price said sales fell",
        "url": "https://news.example/fetched-1",
        "source": "Example",
        "published_at": f"{(day - timedelta(days=1)).isoformat()}T06:00:00.000000Z",
        "entities": [{
            "symbol": "MRP.JO", "name": "Mr Price Group Ltd", "country": "za",
            "type": "equity", "match_score": 30.0, "sentiment_score": -0.3, "highlights": [],
        }],
    }


def closes(day, extra=-0.05, days=200):
    dates = [day - timedelta(days=days - 1 - i) for i in range(days)]
    market, stock = [100.0], [100.0]
    for i in range(1, days):
        r = MARKET[i % len(MARKET)]
        market.append(market[-1] * (1 + r))
        stock.append(stock[-1] * (1 + 0.5 * r + (extra if dates[i] == day else 0.0)))
    return list(zip(dates, stock, strict=True)), list(zip(dates, market, strict=True))


def open_card(client, auth_headers, ticker, day=EVENT_DAY, benchmark=True, stock=True):
    stock_series, market_series = closes(day)
    frame = pd.DataFrame(
        {"Close": [p for _, p in market_series]},
        index=pd.DatetimeIndex([d for d, _ in market_series]),
    )

    def history(symbol, **_kwargs):
        return frame if benchmark and symbol == "STX40.JO" else None

    with patch.object(portfolio_service, "single_ticker_closes",
                      return_value=stock_series if stock else []), \
         patch.object(portfolio_service, "get_cached_price_history", side_effect=history):
        response = client.get(f"/api/portfolio/events/{ticker}/{day.isoformat()}",
                              headers=auth_headers)
    assert response.status_code == 200, response.text
    return response.json()


def fetch_rows(db_session, scope):
    db_session.expire_all()
    return db_session.scalar(select(func.count(NewsFetchLog.id)).where(NewsFetchLog.scope == scope))

def test_a_jse_share_outside_the_catalogue_is_studied_against_the_top_40(
    client, auth_headers, db_session, test_user
):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    store_article(db_session, "MRP.JO", EVENT_DAY)

    card = open_card(client, auth_headers, "MRP.JO")

    assert card["available"] is True
    assert card["benchmark_label"] == "Satrix 40 (JSE Top 40 proxy)"
    assert card["beta"] == 0.5
    parts = card["decomposition"]
    assert parts["stock_return_pct"] == pytest.approx(-4.6, abs=0.01)
    assert parts["market_component_pct"] == pytest.approx(0.4, abs=0.01)
    assert parts["company_component_pct"] == pytest.approx(-5.0, abs=0.01)
    assert card["move_type"] == "against_market"
    assert [a["article_id"] for a in card["possible_explanations"]] == ["stored-1"]


def test_without_top_40_prices_the_card_still_shows_its_article(
    client, auth_headers, db_session, test_user
):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    store_article(db_session, "MRP.JO", EVENT_DAY)

    card = open_card(client, auth_headers, "MRP.JO", benchmark=False)

    assert card["available"] is False
    assert card["reason"] == "no_benchmark_for_region"
    assert card["region"] == "South Africa"
    assert card["name"] == "Mr Price Group Ltd"
    assert [a["article_id"] for a in card["possible_explanations"]] == ["stored-1"]


def test_without_its_own_prices_the_card_still_shows_its_article(
    client, auth_headers, db_session, test_user
):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    store_article(db_session, "MRP.JO", EVENT_DAY)

    card = open_card(client, auth_headers, "MRP.JO", stock=False)

    assert card["reason"] == "no_price_history"
    assert card["date"] == EVENT_DAY.isoformat()
    assert [a["article_id"] for a in card["possible_explanations"]] == ["stored-1"]

@pytest.mark.usefixtures("key")
def test_an_unfetched_window_is_fetched_once_and_shown_straight_away(
    client, auth_headers, db_session, test_user
):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    found = ProviderResult("ok", 200, [marketaux_article(EVENT_DAY)])
    scope = f"backfill:MRP.JO:{EVENT_DAY.isoformat()}"

    with patch.object(news_ingest, "fetch_articles", return_value=found) as provider:
        first = open_card(client, auth_headers, "MRP.JO")
        again = open_card(client, auth_headers, "MRP.JO")

    assert provider.call_count == 1
    assert provider.call_args.args == (
        ["MRP.JO"],
        news_ingest.ON_DEMAND_TIMEOUT_SECONDS,
        (EVENT_DAY - timedelta(days=4)).isoformat(),
        (EVENT_DAY + timedelta(days=2)).isoformat(),
        "za",
    )
    assert fetch_rows(db_session, scope) == 1
    assert [a["article_id"] for a in first["possible_explanations"]] == ["fetched-1"]
    assert first["possible_explanations"][0]["evidence"]["ingest_mode"] == "on_demand"
    assert [a["article_id"] for a in again["possible_explanations"]] == ["fetched-1"]

def _budget_spent(db_session, monkeypatch):
    monkeypatch.setattr(settings, "news_daily_request_budget", 2)
    repo = NewsRepository(db_session)
    repo.record_fetch("nightly:a", "marketaux", 0, ok=True)
    repo.record_fetch("nightly:b", "marketaux", 0, ok=True)
    db_session.commit()


def _breaker_open(_db_session, monkeypatch):
    monkeypatch.setattr(news, "_breaker_open_until", time.monotonic() + 60)


def _no_key(_db_session, monkeypatch):
    monkeypatch.setattr(settings, "market_api_key", None)


def _ten_windows_today(_db_session, _monkeypatch, user_id):
    for _ in range(10):
        assert check_limit(f"event-news:{user_id}", settings.event_news_per_user_daily, 86400)[0]


CASES = {
    "budget used up": ("Mr Price Group", "MRP.JO", EVENT_DAY, _budget_spent),
    "breaker open": ("Mr Price Group", "MRP.JO", EVENT_DAY, _breaker_open),
    "older than a year": ("Mr Price Group", "MRP.JO", date.today() - timedelta(days=366), None),
    "an etf": ("CoreShares Top 50 ETF", "TOP50.JO", EVENT_DAY, None),
    "the region benchmark": ("Satrix 40 Exchange Traded Fund", "STX40.JO", EVENT_DAY, None),
    "no api key": ("Mr Price Group", "MRP.JO", EVENT_DAY, _no_key),
    "11th window today": ("Mr Price Group", "MRP.JO", EVENT_DAY, _ten_windows_today),
}


@pytest.mark.usefixtures("key")
@pytest.mark.parametrize("case", CASES)
def test_no_provider_call_when_a_guard_says_no(
    client, auth_headers, db_session, test_user, monkeypatch, case
):
    name, ticker, day, setup = CASES[case]
    hold(db_session, test_user, name, ticker)
    store_article(db_session, ticker, day)
    if setup is _ten_windows_today:
        setup(db_session, monkeypatch, test_user.id)
    elif setup:
        setup(db_session, monkeypatch)

    with patch.object(news_ingest, "fetch_articles") as provider:
        card = open_card(client, auth_headers, ticker, day)

    provider.assert_not_called()
    assert [a["article_id"] for a in card["possible_explanations"]] == ["stored-1"]

@pytest.mark.usefixtures("key")
def test_five_people_opening_the_same_card_make_one_call(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'news.db'}", connect_args={"timeout": 10})
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    calls = []

    def slow_provider(*_args):
        calls.append(1)
        time.sleep(0.3)
        return ProviderResult("ok", 200, [marketaux_article(EVENT_DAY)])

    gate = threading.Barrier(5)

    def open_it():
        db = session_factory()
        try:
            gate.wait()
            news_ingest.fetch_event_window(db, "MRP.JO", EVENT_DAY, uuid4())
        finally:
            db.close()

    with patch.object(news_ingest, "fetch_articles", side_effect=slow_provider):
        threads = [threading.Thread(target=open_it) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

    db = session_factory()
    try:
        logged = db.scalar(select(func.count(NewsFetchLog.id)))
    finally:
        db.close()
        engine.dispose()
    assert len(calls) == 1
    assert logged == 1

@pytest.mark.usefixtures("key")
def test_a_provider_error_still_shows_what_is_stored(client, auth_headers, db_session, test_user):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    store_article(db_session, "MRP.JO", EVENT_DAY)
    failed = ProviderResult("provider_error", 500)

    with patch.object(news_ingest, "fetch_articles", return_value=failed) as provider:
        card = open_card(client, auth_headers, "MRP.JO")

    assert provider.call_count == 1
    assert [a["article_id"] for a in card["possible_explanations"]] == ["stored-1"]
    assert news._breaker_failures == 1
    scope = f"backfill:MRP.JO:{EVENT_DAY.isoformat()}"
    assert NewsRepository(db_session).fetched_ok(scope) is False


@pytest.mark.usefixtures("key")
def test_the_event_scan_makes_no_provider_call(client, auth_headers, db_session, test_user):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    start = date.today() - timedelta(days=70)
    returns = [0.01 if i % 2 == 0 else -0.01 for i in range(30)] + [0.0] * 29 + [0.02]
    series = [(start, 100.0)]
    for i, r in enumerate(returns, start=1):
        series.append((start + timedelta(days=i), series[-1][1] * math.exp(r)))

    with patch.object(portfolio_service, "closes_for_tickers", return_value={"MRP.JO": series}), \
         patch.object(news_ingest, "fetch_articles") as provider:
        body = client.get("/api/portfolio/events", headers=auth_headers).json()

    assert len(body["events"]) == 1
    assert body["events"][0]["has_news"] is False
    provider.assert_not_called()

def test_the_backfill_plans_the_same_scope_and_window(db_session):
    event = {"ticker": "MRP.JO", "date": EVENT_DAY, "rejected": False, "held": True,
             "z_score": -5.0}

    planned, _ = seed_news.plan_calls(NewsRepository(db_session), [event], budget=5)

    call = planned[0][1]
    assert call.scope == f"backfill:MRP.JO:{EVENT_DAY.isoformat()}"
    assert call.published_after == (EVENT_DAY - timedelta(days=4)).isoformat()
    assert call.published_before == (EVENT_DAY + timedelta(days=2)).isoformat()
    assert call.countries == "za"
    assert seed_news.WINDOW_DAYS_BEFORE is news_ingest.WINDOW_DAYS_BEFORE


def test_a_card_that_finds_news_rings_its_dot_without_waiting_for_the_cache(
    client, auth_headers, db_session, test_user
):
    hold(db_session, test_user, "Mr Price Group", "MRP.JO")
    start = date.today() - timedelta(days=70)
    returns = [0.01 if i % 2 == 0 else -0.01 for i in range(30)] + [0.0] * 29 + [0.02]
    series = [(start, 100.0)]
    for i, r in enumerate(returns, start=1):
        series.append((start + timedelta(days=i), series[-1][1] * math.exp(r)))
    day = series[-1][0]
    someone_else = f"{uuid4()}:1y:3.0"
    portfolio_service._write_events_cache(someone_else, {"events": []})

    def scan():
        with patch.object(portfolio_service, "closes_for_tickers", return_value={"MRP.JO": series}):
            return client.get("/api/portfolio/events", headers=auth_headers).json()["events"]

    assert [(e["date"], e["has_news"]) for e in scan()] == [(day.isoformat(), False)]

    store_article(db_session, "MRP.JO", day)
    card = open_card(client, auth_headers, "MRP.JO", day=day)
    assert [a["article_id"] for a in card["possible_explanations"]] == ["stored-1"]

    assert [e["has_news"] for e in scan()] == [True]
    assert portfolio_service._read_events_cache(someone_else) == {"events": []}
