from app.schemas.portfolio import MarketContextResponse
from app.services.instruments import KIND_STOCK, REGION_SA
from app.services.portfolio_service import _build_market_context


def priced(ticker, value, change, sector="Financials"):
    return {
        "ticker": ticker, "name": ticker, "sector": sector, "kind": KIND_STOCK,
        "region": REGION_SA, "priced_live": change is not None, "value": value,
        "daily_change_pct": change,
    }


def test_a_sector_nothing_could_be_priced_in_says_so_instead_of_reporting_zero():
    context = _build_market_context([priced("SBK.JO", 4000.0, None)])

    sector = context["sectors"][0]
    assert sector["daily_change_pct"] is None
    assert sector["summary"] == "Your Financials holdings (SBK.JO) have no live price today."
    assert sector["priced_weight_pct"] == 0.0


def test_priced_weight_pct_says_how_much_of_the_sector_the_move_covers():
    context = _build_market_context([
        priced("SBK.JO", 3000.0, 2.0),
        priced("FSR.JO", 1000.0, None),
    ])

    sector = context["sectors"][0]
    assert sector["weight_pct"] == 100.0
    assert sector["priced_weight_pct"] == 75.0
    assert sector["daily_change_pct"] == 2.0
    assert sector["summary"] == "Your Financials holdings (SBK.JO, FSR.JO) are up 2.0% today."


def test_the_payload_matches_the_response_model_with_a_null_move_in_it():
    context = _build_market_context([
        priced("SBK.JO", 3000.0, 2.0),
        priced("APN.JO", 1000.0, None, sector="Healthcare"),
    ])

    validated = MarketContextResponse.model_validate(context)

    assert validated.available is True
    healthcare = next(s for s in validated.sectors if s.sector == "Healthcare")
    assert healthcare.daily_change_pct is None


def test_an_empty_book_is_unavailable_rather_than_a_list_of_nothing():
    assert _build_market_context([]) == {"available": False, "sectors": []}
