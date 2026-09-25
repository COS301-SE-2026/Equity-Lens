from unittest.mock import MagicMock, patch

import pytest

from app.models.portfolio import Holdings, Portfolios
from app.routers import news
from app.services import news_ingest


@pytest.fixture(autouse=True)
def _clear_news_cache():
    news._PORTFOLIO_NEWS_CACHE.clear()
    news._TICKER_NEWS_CACHE.clear()
    yield
    news._PORTFOLIO_NEWS_CACHE.clear()
    news._TICKER_NEWS_CACHE.clear()


@pytest.fixture(autouse=True)
def _provider_key(monkeypatch):
    # the routes skip marketaux entirely without a key, and CI has none - these tests are
    # about what happens once a call is made, so they get a placeholder key
    monkeypatch.setattr(news.settings, "market_api_key", "test-key-not-real")


@pytest.fixture()
def holding(db_session, test_user):
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-1", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()

    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Apple", ticker="AAPL",
        sector="Technology", quantity=1, cost_price=100, total_cost=100, weight_percentage=100,
    ))
    db_session.commit()


def marketaux_response():
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "data": [
            {
                "uuid": "abc",
                "title": "Apple ships something",
                "description": "words",
                "image_url": "http://example.com/a.png",
                "published_at": "2026-09-01T00:00:00Z",
                "source": "Example",
                "entities": [{
                    "symbol": "AAPL", "country": "us", "type": "equity", "match_score": 40.0,
                    "sentiment_score": 0.4,
                }],
            }
        ]
    }
    return response


def test_the_ticker_news_route_is_no_longer_anonymous(client):
    # it was the only unauthenticated route in the file, and it proxies a metered third
    # party on our api key
    assert client.get("/api/news/ticker/AAPL").status_code in (401, 403)


@pytest.mark.usefixtures("holding")
def test_ticker_news_calls_marketaux_once_for_two_requests(client, auth_headers):
    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()) as upstream:
        first = client.get("/api/news/ticker/AAPL", headers=auth_headers)
        second = client.get("/api/news/ticker/AAPL", headers=auth_headers)

    assert first.status_code == 200
    assert second.json() == first.json()
    assert upstream.call_count == 1


def test_portfolio_news_calls_marketaux_once_for_two_requests(client, auth_headers, holding):
    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()) as upstream:
        first = client.get("/api/news/portfolio", headers=auth_headers)
        second = client.get("/api/news/portfolio", headers=auth_headers)

    assert first.status_code == 200
    assert second.json() == first.json()
    assert upstream.call_count == 1


def test_portfolio_news_maps_articles_into_the_shape_the_page_renders(
    client, auth_headers, holding
):
    with patch.object(news_ingest.requests, "get", return_value=marketaux_response()):
        body = client.get("/api/news/portfolio", headers=auth_headers).json()

    article = body["results"][0]
    assert article["article_id"] == "abc"
    assert article["source_name"] == "Example"
    assert article["pubDate"] == "2026-09-01T00:00:00Z"
    assert article["sentiment"] == "positive"
    assert body["positive"] == 1


@pytest.mark.usefixtures("holding")
def test_ticker_news_refuses_a_ticker_the_caller_does_not_hold(client, auth_headers):
    # the fixture holds AAPL only. NPN.JO must not reach marketaux at all - the cost of this
    # route is a metered provider call, so the refusal has to happen before the fetch
    with patch.object(news, "_marketaux_result") as provider:
        response = client.get("/api/news/ticker/NPN.JO", headers=auth_headers)

    assert response.status_code == 404
    provider.assert_not_called()


def test_portfolio_news_survives_an_upstream_failure(client, auth_headers, holding):
    # a 429 from marketaux comes back as html, so .json() used to raise and 500 the page
    failing = news.requests.RequestException("429")
    with patch.object(news_ingest.requests, "get", side_effect=failing):
        body = client.get("/api/news/portfolio", headers=auth_headers).json()

    assert body == {"total_articles": 0, "positive": 0, "negative": 0, "neutral": 0, "results": []}


def _capturing_get():
    captured = {}
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"data": []}

    def fake_get(*_args, params, **_kwargs):
        captured.update(params)
        return resp

    return captured, fake_get


def test_marketaux_sends_the_window_bounds_when_given():
    captured, fake_get = _capturing_get()
    news.reset_circuit_breaker()
    with patch.object(news.settings, "market_api_key", "key"), \
         patch.object(news_ingest.requests, "get", side_effect=fake_get):
        out = news._marketaux_articles(
            ["NPN.JO"], published_after="2026-01-01", published_before="2026-01-11"
        )

    assert out == []
    assert captured["published_after"] == "2026-01-01"
    assert captured["published_before"] == "2026-01-11"


def test_marketaux_omits_the_window_bounds_by_default():
    captured, fake_get = _capturing_get()
    news.reset_circuit_breaker()
    with patch.object(news.settings, "market_api_key", "key"), \
         patch.object(news_ingest.requests, "get", side_effect=fake_get):
        news._marketaux_articles(["NPN.JO"])

    assert "published_after" not in captured
    assert "published_before" not in captured


def test_marketaux_is_asked_for_the_holdings_own_ticker_at_the_plans_cap():
    # a bare MTN is Vail Resorts to marketaux. the JSE company is MTN.JO, so that is what goes
    # out, and limit is the free plan's 3 because asking for more buys nothing
    captured, fake_get = _capturing_get()
    news.reset_circuit_breaker()
    with patch.object(news.settings, "market_api_key", "key"), \
         patch.object(news_ingest.requests, "get", side_effect=fake_get):
        news._marketaux_articles(["MTN.JO"])

    assert captured["symbols"] == "MTN.JO"
    assert captured["limit"] == 3
