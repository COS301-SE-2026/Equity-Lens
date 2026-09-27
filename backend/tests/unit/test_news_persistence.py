"""The news router after it started reading from the database instead of the provider."""
from unittest.mock import MagicMock, patch

import pytest

from app.models.news_event import NewsArticle
from app.models.portfolio import Holdings, Portfolios
from app.routers import news
from app.services import news_ingest


@pytest.fixture(autouse=True)
def _reset_module_state():
    news._PORTFOLIO_NEWS_CACHE.clear()
    news._TICKER_NEWS_CACHE.clear()
    news.reset_circuit_breaker()
    yield
    news._PORTFOLIO_NEWS_CACHE.clear()
    news._TICKER_NEWS_CACHE.clear()
    news.reset_circuit_breaker()


@pytest.fixture(autouse=True)
def _provider_key(monkeypatch):
    monkeypatch.setattr(news.settings, "market_api_key", "test-key-not-real")


@pytest.fixture
def holding(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-1", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Naspers Limited", ticker="NPN.JO",
        sector="Technology", quantity=10, cost_price=400, total_cost=4000, weight_percentage=100,
    ))
    db_session.commit()


def marketaux_response():
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "data": [{
            "uuid": "abc",
            "title": "Naspers profit rises",
            "description": "words",
            "url": "https://example.com/abc",
            "image_url": "https://example.com/a.png",
            "published_at": "2026-09-01T00:00:00Z",
            "source": "Example",
            "entities": [{
                "symbol": "NPN.JO", "country": "za", "type": "equity", "match_score": 40.0,
                "sentiment_score": 0.4,
            }],
        }]
    }
    return response


@pytest.mark.usefixtures("holding")
def test_the_refresh_floor_survives_the_in_process_cache_being_dropped(
    client,
    auth_headers,
    db_session,
):
    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()) as upstream:
        client.get("/api/news/portfolio", headers=auth_headers)
        news._PORTFOLIO_NEWS_CACHE.clear()
        second = client.get("/api/news/portfolio", headers=auth_headers)

    assert upstream.call_count == 1
    assert second.json()["total_articles"] == 1
    assert db_session.query(NewsArticle).count() == 1


@pytest.mark.usefixtures("holding")
def test_stored_articles_are_still_served_when_the_provider_is_down(client, auth_headers):
    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()):
        client.get("/api/news/portfolio", headers=auth_headers)

    news._PORTFOLIO_NEWS_CACHE.clear()
    failing = news.requests.RequestException("429")
    with patch.object(news_ingest.requests, "get", side_effect=failing):
        body = client.get("/api/news/portfolio", headers=auth_headers).json()

    assert body["total_articles"] == 1
    assert body["results"][0]["title"] == "Naspers profit rises"


@pytest.mark.usefixtures("holding")
def test_the_article_shape_the_page_renders_is_unchanged(client, auth_headers):
    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()):
        body = client.get("/api/news/portfolio", headers=auth_headers).json()

    article = body["results"][0]
    assert set(article) == {
        "article_id", "title", "description", "image_url", "pubDate",
        "source_name", "category", "sentiment", "sentiment_score",
    }
    assert article["pubDate"] == "2026-09-01T00:00:00Z"
    assert article["category"] == ["NPN.JO"]
    assert body["positive"] == 1


@pytest.mark.usefixtures("holding")
def test_the_breaker_opens_after_three_failures_and_stops_calling(client, auth_headers):
    failing = news.requests.RequestException("upstream down")

    with patch.object(news_ingest.requests, "get", side_effect=failing) as upstream:
        for _ in range(5):
            news._PORTFOLIO_NEWS_CACHE.clear()
            client.get("/api/news/portfolio", headers=auth_headers)

    assert upstream.call_count == news._BREAKER_FAILURE_LIMIT
    assert news._breaker_open() is True


@pytest.mark.usefixtures("holding")
def test_one_success_closes_the_breaker_again(client, auth_headers):
    with patch.object(news_ingest.requests, "get", side_effect=news.requests.RequestException("x")):
        news._PORTFOLIO_NEWS_CACHE.clear()
        client.get("/api/news/portfolio", headers=auth_headers)
        news._PORTFOLIO_NEWS_CACHE.clear()
        client.get("/api/news/portfolio", headers=auth_headers)

    assert news._breaker_failures == 2

    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()):
        news._PORTFOLIO_NEWS_CACHE.clear()
        client.get("/api/news/portfolio", headers=auth_headers)

    assert news._breaker_failures == 0
    assert news._breaker_open() is False


def test_the_l1_cache_is_bounded():
    cache = {}
    for i in range(news._NEWS_CACHE_MAX_KEYS + 50):
        news._cache_put(cache, (f"T{i}.JO",), {"total_articles": i})

    assert len(cache) == news._NEWS_CACHE_MAX_KEYS
    assert ("T0.JO",) not in cache
    assert (f"T{news._NEWS_CACHE_MAX_KEYS + 49}.JO",) in cache


def test_an_expired_entry_is_dropped_on_read():
    cache = {}
    with patch.object(news.time, "monotonic", return_value=0.0):
        news._cache_put(cache, ("NPN.JO",), {"total_articles": 1})
        assert news._cache_get(cache, ("NPN.JO",)) == {"total_articles": 1}

    with patch.object(news.time, "monotonic", return_value=news._NEWS_TTL_SECONDS + 1):
        assert news._cache_get(cache, ("NPN.JO",)) is None

    assert cache == {}


def test_an_article_the_provider_sent_without_a_usable_date_is_dropped_not_stored():
    undated = {"uuid": "a", "title": "t", "published_at": "not a date"}
    untitled = {"uuid": "a", "published_at": "2026-09-01T00:00:00Z"}

    assert news._for_storage(undated, {}) is None
    assert news._for_storage(untitled, {}) is None
