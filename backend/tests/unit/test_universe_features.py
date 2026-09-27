import pytest

from app.services import universe_features as uf


@pytest.fixture
def make_capitec_info():
    def _factory(**overrides):
        info = {
            "marketCap": 518_550_000_000,
            "sector": "Financial Services",
            "floatShares": 87_268_396,
            "sharesOutstanding": 115_853_615,
            "dividendYield": 1.78,
            "longName": "Capitec Bank Holdings Limited",
            "shortName": "Capitec",
            "exchange": "JNB",
            "quoteType": "EQUITY",
        }
        info.update(overrides)
        return info

    return _factory


@pytest.fixture
def cache(monkeypatch):
    """Fake fundamentals cache where tests map tickers to info dictionaries."""
    store = {}
    monkeypatch.setattr(
        uf,
        "get_cached_fundamentals",
        lambda ticker: {"info": store.get(ticker, {})},
    )
    return store


class TestLocalFloatProxyCalculation:
    def test_free_float_percentage_computation(self, make_capitec_info):
        assert uf._local_float_proxy(make_capitec_info()) == 75.33

    def test_free_float_clamping_upper_bound(self, make_capitec_info):
        info = make_capitec_info(floatShares=751_218_731, sharesOutstanding=747_161_004)
        assert uf._local_float_proxy(info) == 100.0

    def test_implausibly_low_float_filtered_as_missing(self, make_capitec_info):
        info = make_capitec_info(floatShares=4, sharesOutstanding=100)
        assert uf._local_float_proxy(info) is None

    @pytest.mark.parametrize("field", ["floatShares", "sharesOutstanding"])
    @pytest.mark.parametrize("invalid_value", [None, 0])
    def test_missing_or_zero_share_counts_return_none(
        self, make_capitec_info, field, invalid_value
    ):
        info = make_capitec_info(**{field: invalid_value})
        assert uf._local_float_proxy(info) is None


class TestFeatureBuilder:
    def test_builds_complete_feature_from_cached_info(self, cache, make_capitec_info):
        cache["CPI.JO"] = make_capitec_info()
        feature = uf.build_feature("CPI.JO")

        assert feature.ticker == "CPI"
        assert feature.name == "Capitec Bank Holdings Limited"
        assert feature.sector == "Financial Services"
        assert feature.market_cap == 518.55
        assert feature.local_float_pct == 75.33
        assert feature.dividend_yield == 1.78

    def test_missing_dividend_yield_defaults_to_zero(self, cache, make_capitec_info):
        cache["SOL.JO"] = make_capitec_info(dividendYield=None)
        feature = uf.build_feature("SOL.JO")

        assert feature.dividend_yield == 0

    @pytest.mark.parametrize(
        ("overrides", "expected_name"),
        [
            ({"longName": None}, "Capitec"),
            ({"longName": None, "shortName": None}, "BBB"),
        ],
    )
    def test_name_fallback_hierarchy(
        self, cache, make_capitec_info, overrides, expected_name
    ):
        ticker = f"{expected_name}.JO"
        cache[ticker] = make_capitec_info(**overrides)

        feature = uf.build_feature(ticker)
        assert feature.name == expected_name

    def test_empty_cache_returns_none(self):
        assert uf.build_feature("NOPE.JO") is None

    @pytest.mark.parametrize(
        "overrides",
        [
            {"marketCap": None},
            {"sector": None},
            {"floatShares": None},
            {"floatShares": 1, "sharesOutstanding": 1000},
        ],
    )
    def test_incomplete_or_invalid_data_returns_none(
        self, cache, make_capitec_info, overrides
    ):
        cache["CPI.JO"] = make_capitec_info(**overrides)
        assert uf.build_feature("CPI.JO") is None


class TestUniverseFeatureBatchProcessor:
    def test_filters_invalid_stocks_and_preserves_input_order(
        self, cache, make_capitec_info
    ):
        cache["AAA.JO"] = make_capitec_info()
        cache["BBB.JO"] = make_capitec_info(sector=None)
        cache["CCC.JO"] = make_capitec_info()

        features = uf.build_universe_features(["AAA.JO", "BBB.JO", "CCC.JO"])
        extracted_tickers = [feature.ticker for feature in features]

        assert extracted_tickers == ["AAA", "CCC"]


class TestJseEquityValidation:
    def test_valid_jse_listed_share_accepted(self, cache, make_capitec_info):
        cache["CPI"] = make_capitec_info()
        assert uf.is_jse_equity("CPI") is True

    def test_jse_listed_etf_excluded(self, cache, make_capitec_info):
        cache["STX40"] = make_capitec_info(quoteType="ETF")
        assert uf.is_jse_equity("STX40") is False

    def test_foreign_exchange_equity_excluded(self, cache, make_capitec_info):
        cache["AAPL"] = make_capitec_info(exchange="NMS")
        assert uf.is_jse_equity("AAPL") is False

    def test_unregistered_ticker_excluded(self):
        assert uf.is_jse_equity("NOPE") is False