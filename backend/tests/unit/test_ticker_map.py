from datetime import UTC, datetime

import pytest

from app.repositories.news_repository import NewsRepository
from app.routers.news import _for_storage
from app.services.ticker_map import canonical_key, listing_country

PUB = datetime(2026, 6, 10, 9, 0, tzinfo=UTC)
WINDOW_START = datetime(2026, 6, 1, tzinfo=UTC)
WINDOW_END = datetime(2026, 6, 30, tzinfo=UTC)

def _article(uuid: str, symbol: str, country: str, published: datetime = PUB) -> dict:
   return {
        "uuid": uuid,
        "title": f"a story naming {symbol}",
        "description": "body",
        "url": f"https://example.com/{uuid}",
        "image_url": None,
        "published_at": published.isoformat().replace("+00:00", "Z"),
        "source": "Example",
        "entities": [{
            "symbol": symbol, "country": country, "type": "equity", "match_score": 40.0,
            "sentiment_score": 0.3,
        }],}

def test_the_stored_key_is_the_held_ticker_and_the_country_follows_the_listing():
    assert canonical_key("npn.jo") == "NPN.JO"
    assert canonical_key("AAPL") == "AAPL"
    assert listing_country("NPN.JO") == "za"
    assert listing_country("AAPL") == "us"

@pytest.mark.parametrize(
    ("holding", "symbol", "country"),
    [
        ("NPN.JO", "NPN.JO", "za"), 
        ("AAPL", "AAPL", "us"),
    ],
)
def test_an_article_marketaux_tags_with_a_holding_is_retrievable_by_that_holding(
    db_session, holding, symbol, country
):
    repo = NewsRepository(db_session)
    row = _for_storage(_article("x", symbol, country), [holding])
    assert row is not None
    assert [t["ticker"] for t in row["tickers"]] == [canonical_key(holding)]
    repo.upsert_articles([row])
    db_session.commit()
    found = repo.articles_in_window(holding, WINDOW_START, WINDOW_END)
    assert [a.external_id for a in found] == ["x"]

@pytest.mark.parametrize("echoed", ["NPN", "NPN.XJSE"])
def test_a_symbol_that_only_shares_the_code_is_not_the_holding(echoed):
    row = _for_storage(_article("y", echoed, "za"), ["NPN.JO"])
    assert row is not None
    assert row["tickers"] == []
    assert row["rejected"][0]["reason"] == "symbol_mismatch"


def test_an_entity_for_a_ticker_we_do_not_hold_is_not_linked():
    row = _for_storage(_article("y", "SBK.JO", "za"), ["NPN.JO"])
    assert row is not None
    assert row["tickers"] == []
