from types import SimpleNamespace
from unittest.mock import ANY, MagicMock

import pytest
from fastapi import HTTPException

from app.routers import explore
from app.services import index_universe
from app.services.exposure_engine import Feature


@pytest.fixture
def make_feature():
    def _factory(ticker: str, sector: str, market_cap: float, float_pct: float, yield_pct: float):
        return Feature(
            ticker=ticker,
            name=ticker,
            sector=sector,
            market_cap=market_cap,
            local_float_pct=float_pct,
            dividend_yield=yield_pct,
        )

    return _factory


@pytest.fixture
def features_registry(make_feature):
    return {
        "SBK": make_feature("SBK", "Financial Services", 496.25, 79.79, 5.89),
        "SLM": make_feature("SLM", "Financial Services", 167.0, 80.0, 6.0),
        "NED": make_feature("NED", "Financial Services", 133.81, 99.38, 7.36),
        "ABG": make_feature("ABG", "Financial Services", 182.41, 99.84, 7.65),
        "MTN": make_feature("MTN", "Communication Services", 355.01, 73.99, 2.53),
        "NPN": make_feature("NPN", "Consumer Cyclical", 532.53, 100.0, 0.68),
        "AGL": make_feature("AGL", "Basic Materials", 942.51, 88.83, 0.71),
        "SMALL": make_feature("SMALL", "Industrials", 2.0, 60.0, 3.0),
    }


@pytest.fixture
def seed_symbols():
    return [f"{ticker}.JO" for ticker in ["SBK", "SLM", "NED", "ABG", "MTN", "NPN", "AGL"]]


@pytest.fixture
def configure_dependencies(monkeypatch, features_registry, seed_symbols):
    def _configure(
        holdings: list[str], jse_equities: list[str] | 
        None = None, universe_error: bool = False):
        jse_set = set(holdings) if jse_equities is None else set(jse_equities)

        def mock_build(tickers):
            stripped = (t.upper().removesuffix(".JO") for t in tickers)
            return [features_registry[t] for t in stripped if t in features_registry]

        mocks = SimpleNamespace(
            get_holdings=MagicMock(return_value=holdings),
            build=MagicMock(side_effect=mock_build),
            universe=MagicMock(
                side_effect=index_universe.UniverseUnavailable("JSE") if universe_error else None,
                return_value=seed_symbols,
            ),
        )

        monkeypatch.setattr(explore.portfolio_tickers, "get_user_holdings", mocks.get_holdings)
        monkeypatch.setattr(explore.universe_features, "is_jse_equity", lambda t: t in jse_set)
        monkeypatch.setattr(explore.universe_features, "build_universe_features", mocks.build)
        monkeypatch.setattr(explore.index_universe, "market_universe", mocks.universe)

        return mocks

    return _configure


@pytest.fixture
def execute_request():
    def _call(k: int = 3, user_id: int = 42):
        return explore.get_recommendations(
            k=k,
            db=MagicMock(),
            current_user=SimpleNamespace(id=user_id),
        )

    return _call


@pytest.fixture
def make_recommendation():
    def _factory(ticker: str, distance: float) -> dict:
        return {
            "ticker": ticker,
            "distance": distance,
            "closeness": 0.5,
            "gaps": {"size": 0.1, "free float": 0.1, "dividend yield": 0.1},
        }

    return _factory


class TestPortfolioEligibility:
    def test_empty_holdings_response(self, configure_dependencies, execute_request):
        configure_dependencies([])

        result = execute_request()

        assert result == {"eligible": False, "reason": "no_holdings", "excluded": []}

    def test_non_jse_holdings_response(self, configure_dependencies, execute_request):
        configure_dependencies(["AAPL", "STX40"], jse_equities=[])

        result = execute_request()

        assert result == {
            "eligible": False,
            "reason": "no_jse_holdings",
            "excluded": ["AAPL", "STX40"],
        }

    def test_holdings_retrieval_scoped_to_authenticated_user(
        self, configure_dependencies, execute_request
    ):
        mocks = configure_dependencies(["SBK"])

        execute_request(user_id=42)

        mocks.get_holdings.assert_called_once_with(ANY, user_id=42)


class TestRecommendationGeneration:
    def test_eligible_portfolio_response_structure(
        self, configure_dependencies, execute_request
    ):
        configure_dependencies(["SBK", "AAPL"], jse_equities=["SBK"])

        result = execute_request(k=3)

        assert result["eligible"] is True
        assert result["excluded"] == ["AAPL"]
        assert [item["ticker"] for item in result["portfolio"]] == ["SBK"]
        assert all(item["highlighted"] for item in result["portfolio"])
        assert 0 < len(result["recommended"]) <= 3

    def test_existing_holdings_excluded_from_recommendations(
        self, configure_dependencies, execute_request
    ):
        configure_dependencies(["SBK", "SLM"])

        recommended_tickers = [item["ticker"] for item in execute_request(k=5)["recommended"]]

        assert "SBK" not in recommended_tickers
        assert "SLM" not in recommended_tickers

    def test_recommendation_copy_and_holding_linkage(
        self, configure_dependencies, execute_request
    ):
        configure_dependencies(["SBK", "MTN"])

        for rec in execute_request(k=5)["recommended"]:
            assert rec["similar_to"] in {"SBK", "MTN"}
            match_percentage = round(rec["closeness"] * 100)
            expected_prefix = f"{match_percentage}% match to {rec['similar_to']}"
            assert rec["description"].startswith(expected_prefix)

    def test_recommendations_sorted_by_ascending_distance(
        self, configure_dependencies, execute_request
    ):
        configure_dependencies(["SBK", "MTN"])

        distances = [rec["distance"] for rec in execute_request(k=5)["recommended"]]

        assert distances == sorted(distances)

    def test_universe_tickers_fetched_with_exchange_suffix(
        self, configure_dependencies, execute_request
    ):
        mocks = configure_dependencies(["SBK", "SMALL"])

        execute_request()

        requested_tickers = mocks.build.call_args[0][0]
        assert "SBK.JO" in requested_tickers
        assert "SBK" not in requested_tickers
        assert "SMALL" in requested_tickers

    def test_universe_unavailable_error_raises_503_http_exception(
        self, configure_dependencies, execute_request
    ):
        configure_dependencies(["SBK"], universe_error=True)

        with pytest.raises(HTTPException) as exc_info:
            execute_request()

        assert exc_info.value.status_code == 503


class TestMergeTopKCandidates:
    @pytest.fixture
    def candidate_matches(self, make_recommendation):
        return {
            "SBK": [
                make_recommendation("SLM", 0.5),
                make_recommendation("ABG", 0.9),
                make_recommendation("NED", 0.2),
            ],
            "MTN": [
                make_recommendation("SLM", 0.3),
                make_recommendation("NPN", 0.8),
            ],
        }

    def test_candidate_retains_closest_holding_relationship(self, candidate_matches):
        merged = {
            item["ticker"]: item
            for item in explore._merge_top_k(candidate_matches, k=10, exclude=set())
        }

        assert merged["SLM"]["similar_to"] == "MTN"
        assert merged["SLM"]["distance"] == 0.3

    def test_excluded_tickers_filtered_from_merged_output(self, candidate_matches):
        merged = explore._merge_top_k(candidate_matches, k=10, exclude={"NED"})
        merged_tickers = [item["ticker"] for item in merged]

        assert "NED" not in merged_tickers

    def test_results_capped_at_k_limit_and_sorted_by_distance(self, candidate_matches):
        merged = explore._merge_top_k(candidate_matches, k=2, exclude=set())
        merged_tickers = [item["ticker"] for item in merged]

        assert merged_tickers == ["NED", "SLM"]

    def test_gap_metrics_preserved_through_merge(self, candidate_matches):
        merged = explore._merge_top_k(candidate_matches, k=10, exclude=set())

        assert all("gaps" in item for item in merged)