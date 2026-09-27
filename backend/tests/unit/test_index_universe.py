from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services import index_universe as iu
from app.services.exposure_engine import Feature


@pytest.fixture
def make_feature():
    def _factory(symbol: str, market_cap: float) -> Feature:
        return Feature(
            ticker=symbol.removesuffix(".JO"),
            name=symbol,
            sector="Financial Services",
            market_cap=market_cap,
            local_float_pct=80.0,
            dividend_yield=5.0,
        )

    return _factory


@pytest.fixture
def make_screener_mock():
    def _factory(symbols: list[str]) -> MagicMock:
        return MagicMock(return_value={"quotes": [{"symbol": s} for s in symbols]})

    return _factory


@pytest.fixture(autouse=True)
def isolated_cache():
    iu._cache.clear()
    yield
    iu._cache.clear()


@pytest.fixture
def mock_db_session():
    session = MagicMock()
    session.get.return_value = None
    return session


@pytest.fixture
def features_registry(monkeypatch):
    """Registry mapping symbols to Feature instances returned by build_feature."""
    registry = {}
    monkeypatch.setattr(
        iu.universe_features,
        "build_feature",
        lambda symbol: registry.get(symbol),
    )
    return registry


class TestUniverseConstructionAndPersistence:
    def test_screener_filtering_and_snapshot_persistence(
        self, monkeypatch, mock_db_session, features_registry, make_feature, make_screener_mock
    ):
        screener = make_screener_mock(["AAA.JO", "BBB.JO", "AAPL", "CCC.JO"])
        monkeypatch.setattr(iu.yf, "screen", screener)

        features_registry.update(
            {
                "AAA.JO": make_feature("AAA.JO", 50),
                "BBB.JO": make_feature("BBB.JO", 0.5),  
                "CCC.JO": None,                         
            }
        )

        symbols = iu.market_universe("JSE", mock_db_session)

        assert symbols == ["AAA.JO"]

        merged_snapshot = mock_db_session.merge.call_args[0][0]
        assert merged_snapshot.market == "JSE"
        assert merged_snapshot.symbols == ["AAA.JO"]
        mock_db_session.commit.assert_called_once()

    def test_retains_top_stocks_by_market_cap_ordering(
        self, monkeypatch, mock_db_session, features_registry, make_feature, make_screener_mock
    ):
        monkeypatch.setattr(iu, "UNIVERSE_SIZE", 2)
        screener = make_screener_mock(["AAA.JO", "BBB.JO", "CCC.JO"])
        monkeypatch.setattr(iu.yf, "screen", screener)

        features_registry.update(
            {
                "AAA.JO": make_feature("AAA.JO", 10),
                "BBB.JO": make_feature("BBB.JO", 30),
                "CCC.JO": make_feature("CCC.JO", 20),
            }
        )

        assert iu.market_universe("JSE", mock_db_session) == ["BBB.JO", "CCC.JO"]


class TestCachingAndColdStart:
    def test_fresh_in_memory_cache_bypasses_external_calls(
        self, monkeypatch, mock_db_session, make_screener_mock
    ):
        screener = make_screener_mock(["AAA.JO"])
        monkeypatch.setattr(iu.yf, "screen", screener)

        iu._cache["JSE"] = {
            "symbols": ["CACHED.JO"],
            "built_at": datetime.now(timezone.utc),
        }

        assert iu.market_universe("JSE", mock_db_session) == ["CACHED.JO"]
        screener.assert_not_called()
        mock_db_session.get.assert_not_called()

    def test_cold_start_loads_stored_snapshot_without_screener_hit(
        self, monkeypatch, mock_db_session, make_screener_mock
    ):
        screener = make_screener_mock(["AAA.JO"])
        monkeypatch.setattr(iu.yf, "screen", screener)

        mock_db_session.get.return_value = SimpleNamespace(
            symbols=["SAVED.JO"],
            built_at=datetime.now(timezone.utc),
        )

        assert iu.market_universe("JSE", mock_db_session) == ["SAVED.JO"]
        screener.assert_not_called()


class TestFailureModesAndDegradedState:
    def test_stale_cache_served_on_screener_failure_with_retry_window(
        self, monkeypatch, mock_db_session
    ):
        failing_screener = MagicMock(side_effect=RuntimeError("Yahoo service down"))
        monkeypatch.setattr(iu.yf, "screen", failing_screener)

        stale_timestamp = datetime.now(timezone.utc) - timedelta(days=8)
        iu._cache["JSE"] = {"symbols": ["OLD.JO"], "built_at": stale_timestamp}

        assert iu.market_universe("JSE", mock_db_session) == ["OLD.JO"]

        assert iu.market_universe("JSE", mock_db_session) == ["OLD.JO"]
        assert failing_screener.call_count == 1

    def test_raises_unavailable_when_screener_fails_without_cached_history(
        self, monkeypatch, mock_db_session
    ):
        failing_screener = MagicMock(side_effect=RuntimeError("Yahoo service down"))
        monkeypatch.setattr(iu.yf, "screen", failing_screener)

        with pytest.raises(iu.UniverseUnavailable):
            iu.market_universe("JSE", mock_db_session)

    def test_raises_unavailable_when_screener_returns_empty_results(
        self, monkeypatch, mock_db_session, make_screener_mock
    ):
        empty_screener = make_screener_mock([])
        monkeypatch.setattr(iu.yf, "screen", empty_screener)

        with pytest.raises(iu.UniverseUnavailable):
            iu.market_universe("JSE", mock_db_session)