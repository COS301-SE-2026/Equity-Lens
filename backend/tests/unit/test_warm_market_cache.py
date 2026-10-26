import logging
from unittest.mock import patch

import pandas as pd
import pytest
from sqlalchemy.orm import sessionmaker

from app.scripts import seed_news, warm_market_cache
from app.services.instruments import KNOWN_INSTRUMENTS


def _priced(tickers, **_options):
    return {t: pd.DataFrame({"Close": [1.0]}) for t in tickers}


@pytest.fixture
def fetchers(db_engine):
    with patch.object(warm_market_cache, "SessionLocal", sessionmaker(bind=db_engine)), \
         patch.object(warm_market_cache, "_held_tickers", return_value=["ZZZ.JO"]), \
         patch.object(warm_market_cache, "get_cached_price_histories",
                      side_effect=_priced) as prices, \
         patch.object(warm_market_cache, "get_cached_fundamentals",
                      return_value={"info": {"sector": "x"}}) as fundamentals, \
         patch.object(warm_market_cache.index_universe, "market_universe",
                      return_value=["NPN", "SBK"]) as universe, \
         patch.object(warm_market_cache.universe_features, "build_universe_features",
                      return_value=["f1", "f2"]) as features:
        yield prices, fundamentals, universe, features


def _expected_prices():
    catalogue = {i.ticker for i in KNOWN_INSTRUMENTS.values() if i.ticker.endswith(".JO")}
    return set(seed_news.SEED_UNIVERSE) | {"ZZZ.JO"} | seed_news.BENCHMARK_TICKERS | catalogue


def test_plan_counts_and_calls_nothing(fetchers, caplog):
    caplog.set_level(logging.INFO)

    assert warm_market_cache.main(["--plan"]) == 0

    assert all(not mock.called for mock in fetchers)
    assert f"{len(_expected_prices())} tickers to price" in caplog.text


def test_a_run_prices_every_ticker_in_chunks_of_25(fetchers):
    prices, fundamentals, universe, features = fetchers

    summary = warm_market_cache.warm(False, False, False, False)

    chunks = [call.args[0] for call in prices.call_args_list]
    assert all(len(chunk) <= 25 for chunk in chunks)
    assert {t for chunk in chunks for t in chunk} == _expected_prices()
    year_live = {"period": "1y", "force_live": True}
    assert all(call.kwargs == year_live for call in prices.call_args_list)

    asked = [call.args[0] for call in fundamentals.call_args_list]
    assert len(asked) == len(set(asked))
    assert {"SHP.JO", "ZZZ.JO", "NPN.JO"} <= set(asked)
    assert not {"STX40.JO", "STXRES.JO", "SPY"} & set(asked)

    universe.assert_called_once()
    features.assert_called_once_with(["NPN", "SBK"])
    assert summary["explore"] == 2
    assert summary["failed"] == {"prices": [], "fundamentals": []}


def test_one_failing_ticker_is_listed_and_the_rest_still_run(fetchers):
    _, fundamentals, _, _ = fetchers

    def flaky(ticker):
        if ticker == "SHP.JO":
            raise RuntimeError("yahoo")
        return {"info": {"sector": "x"}}

    fundamentals.side_effect = flaky

    summary = warm_market_cache.warm(False, True, False, True)

    assert summary["failed"] == {"fundamentals": ["SHP.JO"]}
    assert fundamentals.call_count == summary["fundamentals"]


def test_a_price_chunk_that_raises_marks_its_tickers_failed(fetchers):
    prices, _, _, _ = fetchers
    prices.side_effect = RuntimeError("yahoo")

    summary = warm_market_cache.warm(False, False, True, True)

    assert sorted(summary["failed"]["prices"]) == sorted(_expected_prices())