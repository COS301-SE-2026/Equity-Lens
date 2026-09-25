"""The two endpoints, end to end over the test client.

Price history is stubbed at the one seam that reads it (risk_analytics, re-exported into
portfolio_service) so the fixtures are the same constructed series the unit tests use, rather
than whatever happens to be in the cache.
"""
import json
import math
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

import pytest

from app.models.market_data import MarketData
from app.models.news_event import NewsIngestRun, PriceAnomaly
from app.models.portfolio import (
    Holdings,
    InstrumentPurchasesAndSales,
    Portfolios,
    PortfolioSnapshot,
)
from app.repositories.news_repository import NewsRepository
from app.services import portfolio_service

START = date(2026, 1, 1)


def prices(returns, start_price=100.0):
    out = [(START, start_price)]
    price = start_price
    for i, r in enumerate(returns, start=1):
        price *= math.exp(r)
        out.append((START + timedelta(days=i), price))
    return out


def simple_prices(returns, start_price=100.0):
    # the event study works in simple returns, so its fixtures compound them that way
    out = [(START, start_price)]
    price = start_price
    for i, r in enumerate(returns, start=1):
        price *= 1 + r
        out.append((START + timedelta(days=i), price))
    return out


def series_with_one_spike():
    """60 returns: an alternating +/-1% seed, 29 flat days, then a +2% day.

    The same fixture as test_event_detection, where the z-score is worked out by hand as 4.82.
    """
    seed = [0.01 if i % 2 == 0 else -0.01 for i in range(30)]
    return prices(seed + [0.0] * 29 + [0.02])


def quiet_series():
    return prices([0.01 if i % 2 == 0 else -0.01 for i in range(60)])


@pytest.fixture
def portfolio_with_naspers(db_session, test_user):
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
    return portfolio


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_scan_finds_the_spike_and_reports_the_hand_computed_z(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}):
        body = client.get("/api/portfolio/events", headers=auth_headers).json()

    assert body["k_sigma"] == 3.0
    assert len(body["events"]) == 1
    assert body["events"][0]["ticker"] == "NPN.JO"
    assert body["events"][0]["z_score"] == 4.82
    assert body["coverage"]["holdings_scanned"] == 1
    assert body["coverage"]["holdings_skipped"] == []


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_a_holding_without_enough_history_is_named_rather_than_left_out(client, auth_headers):
    # silence here would read as "nothing unusual happened", which is a different claim from
    # "there is not enough price history to say"
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": prices([0.01] * 10)}):
        body = client.get("/api/portfolio/events", headers=auth_headers).json()

    assert body["events"] == []
    assert body["coverage"]["holdings_scanned"] == 0
    assert body["coverage"]["holdings_skipped"] == [
        {"ticker": "NPN.JO", "reason": "insufficient_history", "observations": 10}
    ]


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_a_quiet_holding_is_scanned_and_produces_nothing(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": quiet_series()}):
        body = client.get("/api/portfolio/events", headers=auth_headers).json()

    assert body["events"] == []
    assert body["coverage"]["holdings_scanned"] == 1
    assert body["coverage"]["events_found"] == 0


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_scan_is_cached_per_user_and_cleared_with_the_priced_holdings(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}) as reader:
        client.get("/api/portfolio/events", headers=auth_headers)
        client.get("/api/portfolio/events", headers=auth_headers)
        assert reader.call_count == 1

        portfolio_service.invalidate_priced_holdings()
        client.get("/api/portfolio/events", headers=auth_headers)
        assert reader.call_count == 2


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_a_different_threshold_is_a_different_cache_entry(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}) as reader:
        loose = client.get("/api/portfolio/events?k=3.0", headers=auth_headers).json()
        strict = client.get("/api/portfolio/events?k=6.0", headers=auth_headers).json()

    assert reader.call_count == 2
    assert len(loose["events"]) == 1
    assert strict["events"] == []


@pytest.mark.parametrize("query", ["?period=forever", "?k=0.5", "?k=99"])
@pytest.mark.usefixtures("portfolio_with_naspers")
def test_a_parameter_outside_its_range_is_a_400_not_a_silent_default(
    client,
    auth_headers,
    query,
):
    assert client.get(f"/api/portfolio/events{query}", headers=auth_headers).status_code == 400


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_scan_never_runs_a_regression(client, auth_headers):
    # the whole point of splitting the pair: one fit per book, on request, not one per event
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}), \
         patch.object(portfolio_service, "run_event_study") as regression:
        client.get("/api/portfolio/events", headers=auth_headers)

    regression.assert_not_called()


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_a_ticker_that_is_not_held_is_a_404(client, auth_headers):
    response = client.get("/api/portfolio/events/SBK.JO/2026-03-02", headers=auth_headers)

    assert response.status_code == 404


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_detail_endpoint_fits_one_model_and_lists_articles_without_claiming_cause(
    client,
    auth_headers,
    db_session,
):
    event_day = date(2026, 6, 10)
    market = [0.01, -0.006, 0.004, -0.002, 0.008] * 60
    stock = simple_prices([0.5 * r for r in market])
    levels = dict(simple_prices(market))

    repo = NewsRepository(db_session)
    repo.upsert_articles([{
        "external_id": "abc",
        "source": "marketaux",
        "title": "Naspers reports first-half results",
        "description": "Naspers said ecommerce revenue grew",
        "url": "https://example.com/abc",
        "image_url": None,
        "source_name": "Example",
        "published_at": datetime(2026, 6, 9, 6, 0, tzinfo=UTC),
        "sentiment": "positive",
        "sentiment_score": 0.4,
        "tickers": [{"ticker": "NPN.JO", "sentiment_score": 0.4, "match_score": 45.0}],
    }])
    db_session.commit()

    with patch.object(portfolio_service, "single_ticker_closes", return_value=stock), \
         patch.object(portfolio_service, "benchmark_levels",
                      return_value=("JSE Top 40", levels)) as benchmark:
        body = client.get(
            f"/api/portfolio/events/NPN.JO/{event_day.isoformat()}", headers=auth_headers
        ).json()

    assert body["available"] is True
    assert body["beta"] == 0.5
    assert body["r_squared"] == 1.0
    assert body["benchmark_label"] == "JSE Top 40"
    assert body["estimation_window"]["offsets"] == [-120, -21]
    # NPN.JO is quoted in rand, so the index is asked for in rand
    assert benchmark.call_args.args[2] == "ZAR"

    explanation = body["possible_explanations"][0]
    assert explanation["article_id"] == "abc"
    assert set(explanation["scores"]) == {
        "bm25", "bm25_normalised", "date_proximity", "entity_match", "combined",
    }
    # published 06:00 UTC on the 9th is 08:00 SAST on the 9th, the day before the event, and
    # the headline names Naspers - so "close"
    assert explanation["relevance"] == "close"
    evidence = explanation["evidence"]
    assert evidence["named_in_headline"] is True
    assert evidence["provider_match_score"] == 45.0
    assert evidence["days_from_event"] == -1
    assert evidence["ingest_mode"] is None
    assert evidence["collected_at"].endswith("Z")

    # nothing in the payload may assert that the article moved the price
    wording = " ".join(str(v) for v in [body["note"], *body["possible_explanations"]]).lower()
    for forbidden in ("caused", "because of", "due to", "driven by", "led to"):
        assert forbidden not in wording


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_detail_endpoint_says_why_when_it_cannot_fit(client, auth_headers):
    with patch.object(portfolio_service, "single_ticker_closes", return_value=[]):
        body = client.get("/api/portfolio/events/NPN.JO/2026-06-10", headers=auth_headers).json()

    assert body["available"] is False
    assert body["reason"] == "no_price_history"
    assert body["abnormal_returns"] == []


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_dashboard_response_is_unchanged_by_any_of_this(client, auth_headers):
    # the prompt's hard line: nothing new on GET /api/portfolio
    body = client.get("/api/portfolio", headers=auth_headers).json()

    assert "events" not in body
    assert "anomalies" not in body


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_every_event_carries_the_figures_behind_its_sigma(client, auth_headers):
    # "a 4.8 sigma move" is an assertion until the reader can see the sigma and the sample
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}):
        body = client.get("/api/portfolio/events", headers=auth_headers).json()

    event = body["events"][0]
    assert event["observations"] == 60
    # sigma on the event day is 0.0041468231 daily; annualised that is
    #   0.0041468231 * sqrt(252) * 100 = 6.58%
    assert event["annualised_volatility_pct"] == pytest.approx(6.58, abs=0.01)
    # and the z-score is the return over that same daily sigma
    assert event["z_score"] == 4.82


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_coverage_lists_every_scanned_holding_with_its_volatility(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": quiet_series()}):
        body = client.get("/api/portfolio/events", headers=auth_headers).json()

    assert body["coverage"]["holdings"] == [
        {
            "ticker": "NPN.JO",
            "name": "Naspers Limited",
            "observations": 60,
            "annualised_volatility_pct": pytest.approx(16.0, abs=0.5),
        }
    ]


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_series_endpoint_returns_dated_closes_for_a_held_ticker(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": prices([0.01, 0.02])}) as reader:
        body = client.get(
            "/api/portfolio/holdings/series?tickers=NPN.JO", headers=auth_headers
        ).json()

    reader.assert_called_once_with(["NPN.JO"], period="1y")
    assert body["period"] == "1y"
    assert body["series"][0]["ticker"] == "NPN.JO"
    assert body["series"][0]["name"] == "Naspers Limited"
    assert [p["date"] for p in body["series"][0]["points"]] == [
        "2026-01-01", "2026-01-02", "2026-01-03",
    ]
    assert body["not_held"] == []


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_series_endpoint_refuses_to_price_something_the_user_does_not_hold(
    client, auth_headers
):
    # it sits behind the user's login, so it serves their portfolio and not the whole market
    with patch.object(portfolio_service, "closes_for_tickers") as reader:
        body = client.get(
            "/api/portfolio/holdings/series?tickers=AAPL,TSLA", headers=auth_headers
        ).json()

    reader.assert_not_called()
    assert body["series"] == []
    assert body["not_held"] == ["AAPL", "TSLA"]


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_a_held_ticker_with_no_cached_history_comes_back_empty_rather_than_missing(
    client, auth_headers
):
    # the chart needs to be able to say which line it could not draw
    with patch.object(portfolio_service, "closes_for_tickers", return_value={"NPN.JO": []}):
        body = client.get(
            "/api/portfolio/holdings/series?tickers=NPN.JO", headers=auth_headers
        ).json()

    assert body["series"] == [{"ticker": "NPN.JO", "name": "Naspers Limited", "points": []}]


@pytest.mark.usefixtures("portfolio_with_naspers")
@pytest.mark.parametrize("query", ["tickers=&period=1y", "tickers=NPN.JO&period=forever"])
def test_the_series_endpoint_rejects_bad_parameters(client, auth_headers, query):
    response = client.get(f"/api/portfolio/holdings/series?{query}", headers=auth_headers)
    assert response.status_code == 400


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_every_event_says_how_unusual_it_was(client, auth_headers):
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}):
        event = client.get("/api/portfolio/events", headers=auth_headers).json()["events"][0]

    # z = 4.82: over 4, under 5
    assert event["band"] == "very_unusual"
    assert event["times_normal"] == 4.8
    assert event["daily_sigma_pct"] == 0.41
    assert event["rank_in_period"] == 1
    assert event["period_days"] == 60


@pytest.mark.parametrize(("k", "expected"), [(3.0, 2.7), (4.0, 0.1)])
@pytest.mark.usefixtures("portfolio_with_naspers")
def test_coverage_says_how_many_events_chance_alone_would_give(client, auth_headers, k, expected):
    # 1030 alternating +/-1% returns: 30 seed days and 1000 scored, none of them unusual.
    #   k = 3: erfc(3 / sqrt(2)) = 0.0026998, so 1000 days -> 2.6998 -> 2.7
    #   k = 4: erfc(4 / sqrt(2)) = 0.0000633, so 1000 days -> 0.0633 -> 0.1
    calm = prices([0.01 if i % 2 == 0 else -0.01 for i in range(1030)])
    with patch.object(portfolio_service, "closes_for_tickers", return_value={"NPN.JO": calm}):
        coverage = client.get(
            f"/api/portfolio/events?k={k}", headers=auth_headers
        ).json()["coverage"]

    assert coverage["scored_days_total"] == 1000
    assert coverage["expected_by_chance"] == expected
    assert "fatter tails" in coverage["chance_note"]


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_k_is_rounded_to_a_half_so_nearby_values_share_one_scan(client, auth_headers):
    # 3.2 * 2 = 6.4, rounds to 6, back to 3.0 - the same cache entry as asking for 3.0
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}) as reader:
        exact = client.get("/api/portfolio/events?k=3.0", headers=auth_headers).json()
        nearby = client.get("/api/portfolio/events?k=3.2", headers=auth_headers).json()

    assert reader.call_count == 1
    assert nearby["k_sigma"] == exact["k_sigma"] == 3.0


def the_clients_day(day_before=0.0):
    """MTN's day, built so every figure on the card can be worked by hand.

    100 estimation days where the stock is 0.48 x the market plus noise that is uncorrelated
    with it (beta = 0.48 exactly), 20 flat days, then day 0: market -0.4%, stock -10.8%. ten
    flat days follow. day_before sets the stock's own move on the day before the event.
    """
    x = [[0.01, -0.01, 0.02, -0.02][i % 4] for i in range(100)]
    e = [[0.003, 0.003, -0.003, -0.003][i % 4] for i in range(100)]
    y = [0.48 * m + err for m, err in zip(x, e, strict=True)]
    market = x + [0.0] * 20 + [-0.004] + [0.0] * 10
    stock = y + [0.0] * 19 + [day_before] + [-0.108] + [0.0] * 10
    return simple_prices(stock, 50.0), simple_prices(market), START + timedelta(days=121)


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_detail_splits_the_move_into_parts_that_add_up(client, auth_headers):
    stock, market, event_day = the_clients_day()
    with patch.object(portfolio_service, "single_ticker_closes", return_value=stock), \
         patch.object(portfolio_service, "benchmark_levels",
                      return_value=("JSE Top 40", dict(market))):
        body = client.get(
            f"/api/portfolio/events/NPN.JO/{event_day.isoformat()}", headers=auth_headers
        ).json()

    # -10.80 = -0.19 + -10.61, where -0.19 = round(0.48 * -0.4, 2)
    assert body["decomposition"] == {
        "stock_return_pct": -10.8,
        "market_return_pct": -0.4,
        "beta": 0.48,
        "market_component_pct": -0.19,
        "company_component_pct": -10.61,
    }
    assert body["decomposition_reason"] is None
    # 10.61 / 10.8 = 0.98 of the move is the company's
    assert body["move_type"] == "company"
    # sigma_ar = 0.003 * sqrt(100/99) = 0.0030151, s = 0.003 * sqrt(100/98) = 0.0030305,
    # alpha_se = s / 10 (see test_event_study for the construction)
    assert body["sigma_ar"] == 0.003015
    assert body["alpha_se"] == 0.000303
    assert body["alpha_t"] == pytest.approx(0.0, abs=1e-9)
    # ten flat days after, so the CAR holds at -10.61 on day +10
    assert body["after_event"]["days"] == 10
    assert body["after_event"]["car_pct"] == -10.61
    assert body["after_event"]["significant"] is True


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_no_split_is_shown_when_the_index_is_missing_the_day_before(client, auth_headers):
    # the stock rose 2% the day before, and the index has no close that day. the aligned
    # return then runs from two days back: 1.02 * 0.892 - 1 = -9.02%, against the -10.8% the
    # detector reported. showing parts of -9.02 under a -10.8 headline would not add up
    stock, market, event_day = the_clients_day(day_before=0.02)
    levels = {day: level for day, level in market if day != event_day - timedelta(days=1)}
    with patch.object(portfolio_service, "single_ticker_closes", return_value=stock), \
         patch.object(portfolio_service, "benchmark_levels", return_value=("JSE Top 40", levels)):
        body = client.get(
            f"/api/portfolio/events/NPN.JO/{event_day.isoformat()}", headers=auth_headers
        ).json()

    assert body["available"] is True
    assert body["decomposition"] is None
    assert body["decomposition_reason"] == "benchmark_missing_day"
    assert body["move_type"] == "unknown"


EVENT_DAY = date.today() - timedelta(days=10)
DAY_BEFORE = EVENT_DAY - timedelta(days=1)


@pytest.fixture
def hundred_npn_with_a_ledger(db_session, test_user):
    """100 NPN.JO held now, a R12,000 snapshot and a R50 close on the day before the event."""
    portfolio = Portfolios(
        user_id=test_user.id, account_number="EE-2", portfolio_name="EasyEquities", currency="ZAR",
    )
    db_session.add(portfolio)
    db_session.commit()
    db_session.add(Holdings(
        portfolio_id=portfolio.id, instrument_name="Naspers Limited", ticker="NPN.JO",
        sector="Technology", quantity=100, cost_price=40, total_cost=4000, weight_percentage=100,
    ))
    db_session.add(PortfolioSnapshot(
        portfolio_id=portfolio.id, snapshot_date=DAY_BEFORE, total_value=12000,
    ))
    # MarketData holds JSE closes in cents, so R50 is 5000
    db_session.add(MarketData(
        ticker="NPN.JO", date=DAY_BEFORE, open=5000, high=5000, low=5000, close=5000,
        prev_close=5000, volume=1,
    ))
    db_session.commit()
    return portfolio


def _bought(db_session, portfolio, day, quantity):
    db_session.add(InstrumentPurchasesAndSales(
        portfolio_id=portfolio.id, transaction_date=day, transaction_name="Buy",
        instrument_name="Naspers Limited", ticker="NPN.JO", quantity=quantity,
        value_zar=quantity * 45,
    ))
    db_session.commit()


def _impact(client, auth_headers):
    # R50 the day before, R45 on the day: a -10% move
    closes = [(DAY_BEFORE, 50.0), (EVENT_DAY, 45.0)]
    with patch.object(portfolio_service, "single_ticker_closes", return_value=closes), \
         patch.object(portfolio_service, "benchmark_levels",
                      return_value=("JSE Top 40", dict(closes))):
        return client.get(
            f"/api/portfolio/events/NPN.JO/{EVENT_DAY.isoformat()}", headers=auth_headers
        ).json()["portfolio_impact"]


def test_the_impact_uses_what_was_held_the_day_before(
    client, auth_headers, db_session, hundred_npn_with_a_ledger
):
    # 40 of the 100 were bought on the event day itself, during the move, so 60 were held at
    # the close before it. values are in rands, the snapshot path's unit (cents / 100):
    #   60 x R50 = R3,000 of a R12,000 portfolio -> 25% weight
    #   25% x -10% = -2.5% of the portfolio
    _bought(db_session, hundred_npn_with_a_ledger, EVENT_DAY, 40)

    impact = _impact(client, auth_headers)

    assert impact == {
        "held_on_date": True,
        "weight_pct": 25.0,
        "contribution_pct": -2.5,
        "basis": "holdings_on_date",
    }


def test_a_holding_bought_after_the_event_did_not_move_the_portfolio(
    client, auth_headers, db_session, hundred_npn_with_a_ledger
):
    # all 100 arrived two days later, so 100 - 100 = 0 were held on the day
    _bought(db_session, hundred_npn_with_a_ledger, EVENT_DAY + timedelta(days=2), 100)

    impact = _impact(client, auth_headers)

    assert impact == {
        "held_on_date": False,
        "weight_pct": None,
        "contribution_pct": None,
        "basis": "not_held",
    }


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_with_no_snapshot_the_impact_falls_back_to_todays_weight_and_says_so(
    client, auth_headers
):
    # no snapshot and no close the day before. NPN.JO is the only holding, so today's weight
    # is 100% and the contribution is 100% x -10% = -10%
    impact = _impact(client, auth_headers)

    assert impact == {
        "held_on_date": True,
        "weight_pct": 100.0,
        "contribution_pct": -10.0,
        "basis": "current_weight",
    }


def _linked(db_session, external_id, title, published, match_score):
    NewsRepository(db_session).upsert_articles([{
        "external_id": external_id, "source": "marketaux", "title": title,
        "published_at": published,
        "tickers": [{"ticker": "NPN.JO", "match_score": match_score}],
    }])
    db_session.commit()


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_has_news_uses_the_same_test_as_the_panel(client, auth_headers, db_session):
    # the spike is on day 60, 2026-03-02. a link from before scores were stored (match_score
    # null) is not evidence, so on its own it must not light the dot
    spike_day = START + timedelta(days=60)
    _linked(db_session, "old", "Naspers shares jump", datetime.combine(spike_day,
            datetime.min.time(), tzinfo=UTC) + timedelta(hours=8), None)
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}):
        before = client.get("/api/portfolio/events", headers=auth_headers).json()

    portfolio_service.invalidate_priced_holdings()
    _linked(db_session, "new", "Naspers shares jump", datetime.combine(spike_day,
            datetime.min.time(), tzinfo=UTC) + timedelta(hours=8), 40.0)
    with patch.object(portfolio_service, "closes_for_tickers",
                      return_value={"NPN.JO": series_with_one_spike()}):
        after = client.get("/api/portfolio/events", headers=auth_headers).json()

    assert before["events"][0]["has_news"] is False
    assert after["events"][0]["has_news"] is True


SCAN_START = datetime(2026, 9, 24, 0, 30, tzinfo=UTC)
AFTER_SCAN = SCAN_START + timedelta(minutes=1)


def _scan(db_session, others):
    """A nightly run that scored NPN.JO and `others` more tickers across the client's day."""
    covered = {f"T{i:02d}.JO": ["2026-01-01", "2026-09-23"] for i in range(others)}
    covered["NPN.JO"] = ["2026-01-01", "2026-09-23"]
    # its scoring stopped two days before the client's day, so it was not looked at then
    covered["OLD.JO"] = ["2026-01-01", "2026-04-30"]
    db_session.add(NewsIngestRun(mode="nightly", status="ok", started_at=SCAN_START,
                                 details=json.dumps({"scanned": covered})))
    db_session.commit()


def _flagged(db_session, day, ticker, z, validation="ok", seen=AFTER_SCAN):
    db_session.add(PriceAnomaly(
        ticker=ticker, event_date=day, k_sigma=3.0, return_pct=z, z_score=z, sigma=0.02,
        direction="up" if z > 0 else "down", band="unusual", validation=validation,
        first_seen_at=seen, last_seen_at=seen,
    ))


def _same_day(client, auth_headers):
    stock, market, event_day = the_clients_day()
    with patch.object(portfolio_service, "single_ticker_closes", return_value=stock), \
         patch.object(portfolio_service, "benchmark_levels",
                      return_value=("JSE Top 40", dict(market))):
        return client.get(
            f"/api/portfolio/events/NPN.JO/{event_day.isoformat()}", headers=auth_headers
        ).json()["same_day"]


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_the_card_counts_the_other_tickers_that_moved_that_day(client, auth_headers, db_session):
    _, _, day = the_clients_day()
    _scan(db_session, 48)
    # six others fell unusually, as NPN.JO did (-10.8%), and one rose
    for i, z in enumerate([-3.1, -3.4, -5.6, -4.0, -3.2, -4.4]):
        _flagged(db_session, day, f"T{i:02d}.JO", z)
    _flagged(db_session, day, "T06.JO", 3.3)
    # none of these count: NPN.JO itself, bad data, a row the latest scan did not see again, a
    # ticker the scan never covered, and one whose scan ended before this day
    _flagged(db_session, day, "NPN.JO", -7.0)
    _flagged(db_session, day, "T07.JO", -9.0, validation="spike")
    _flagged(db_session, day, "T08.JO", -4.1, seen=SCAN_START - timedelta(days=1))
    _flagged(db_session, day, "ZZZ.JO", -4.1)
    _flagged(db_session, day, "OLD.JO", -4.1)
    db_session.commit()

    same_day = _same_day(client, auth_headers)

    # 48 others cover the day: OLD.JO stops on 30 April and NPN.JO is the card's own ticker
    assert same_day["scanned"] == 48
    # 6 down + 1 up = 7 unusual, 6 of them the same way
    assert same_day["unusual"] == 7
    assert same_day["same_direction"] == 6
    # the five largest |z| of the six: 5.6, 4.4, 4.0, 3.4, 3.2 (3.1 is left off)
    assert same_day["tickers"] == ["T02.JO", "T05.JO", "T03.JO", "T01.JO", "T04.JO"]
    # 48 * erfc(3 / sqrt 2) = 48 * 0.0027 = 0.1296, rounded to 0.13
    assert same_day["expected_by_chance"] == 0.13


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_nine_other_tickers_are_too_few_to_say_anything(client, auth_headers, db_session):
    _scan(db_session, 9)

    assert _same_day(client, auth_headers) is None


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_ten_other_tickers_is_enough_even_when_none_moved(client, auth_headers, db_session):
    _scan(db_session, 10)

    same_day = _same_day(client, auth_headers)

    # 10 * 0.0027 = 0.027, rounded to 0.03
    assert same_day == {"scanned": 10, "unusual": 0, "same_direction": 0, "tickers": [],
                        "expected_by_chance": 0.03}


@pytest.mark.usefixtures("portfolio_with_naspers")
def test_before_any_scan_is_recorded_there_is_no_same_day_count(client, auth_headers):
    assert _same_day(client, auth_headers) is None

