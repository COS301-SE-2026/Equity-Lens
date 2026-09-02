import pytest

from app.services.instruments import (
    KIND_ETF,
    KIND_STOCK,
    KNOWN_INSTRUMENTS,
    REGION_BENCHMARKS,
    REGION_EM,
    REGION_GLOBAL,
    REGION_SA,
    REGION_US,
    get_look_through_note,
    looks_like_fund,
    normalize_sector,
    resolve_known_instrument,
)


@pytest.mark.parametrize(
    ("instrument_name", "ticker", "kind", "region"),
    [
        ("10X S&P South Africa Top50 Index Exchange Traded Fund", "CTOP50.JO", KIND_ETF, REGION_SA),
        ("Satrix MSCI World Exchange Traded Fund", "STXWDM.JO", KIND_ETF, REGION_GLOBAL),
        ("Satrix MSCI Emerging Markets ETF", "STXEMG.JO", KIND_ETF, REGION_EM),
        ("Sygnia Itrix S&P 500 ETF", "SYG500.JO", KIND_ETF, REGION_US),
        ("Satrix S&P 500 ETF", "STX500.JO", KIND_ETF, REGION_US),
        ("1NVEST S&P 500 Index STANLIB Feeder ETF", "ETF500.JO", KIND_ETF, REGION_US),
        ("Naspers Limited", "NPN.JO", KIND_STOCK, REGION_SA),
        ("Standard Bank Group", "SBK.JO", KIND_STOCK, REGION_SA),
    ],
)
def test_resolves_instrument_metadata(instrument_name, ticker, kind, region):
    resolved = resolve_known_instrument(instrument_name)
    assert resolved is not None
    assert resolved.ticker == ticker
    assert resolved.kind == kind
    assert resolved.region == region


@pytest.mark.parametrize(
    "spelling",
    [
        "EasyETFs AI World Actively Managed ETF",
        "EASYETFS AI WORLD AMETF",
        "  easyetfs   ai   world   ametf  ",
        "Traded Fund EasyETFs AI World Actively Managed ETF",
    ],
)
def test_fund_suffix_spellings_collapse_to_one_entry(spelling):
    resolved = resolve_known_instrument(spelling)
    assert resolved is not None
    assert resolved.ticker == "EASYAI.JO"


@pytest.mark.parametrize(
    ("mangled", "ticker"),
    [
        ("10X S&P South Africa Top50 Index Exchange", "CTOP50.JO"),
        ("10X S&P South Africa Top50 Index Exchange Traded Fund", "CTOP50.JO"),
        ("10X S&P South Africa Top 50", "CTOP50.JO"),
        ("10X S&P 500 Exchange Traded Fund", "CSP500.JO"),
        ("Satrix MSCI Emerging Markets ETF", "STXEMG.JO"),
        ("10X S&P South Africa Top50 Index ExchangeTraded Fund", "CTOP50.JO"),
        ("10X S&P 500 ExchangeTraded Fund", "CSP500.JO"),
        ("Satrix MSCI EmergingMarkets ETF", "STXEMG.JO"),
        ("EasyETFs AI World ActivelyManaged ETF", "EASYAI.JO"),
    ],
)
def test_resolves_names_the_pdf_parser_mangled(mangled, ticker):
    resolved = resolve_known_instrument(mangled)
    assert resolved is not None, f"{mangled} did not resolve"
    assert resolved.ticker == ticker


def test_jse_listed_global_fund_is_not_classified_as_south_africa():
    resolved = resolve_known_instrument("EasyETFs AI World Actively Managed ETF")
    assert resolved.region == REGION_GLOBAL


def test_bhp_uses_its_jse_code():
    assert resolve_known_instrument("BHP Group").ticker == "BHG.JO"


@pytest.mark.parametrize(
    ("instrument_name", "expected"),
    [
        ("Some Tracker Fund We Have Never Seen", True),
        ("Ashburton Global Feeder", True),
        ("Acme Widgets Holdings", False),
    ],
)
def test_unknown_fund_detection(instrument_name, expected):
    assert looks_like_fund(instrument_name) is expected


@pytest.mark.parametrize(
    ("spelling", "ticker"),
    [
        ("Satrix S&P 500 ETF", "STX500.JO"),
        ("Satrix S&P 500 Exchange Traded Fund", "STX500.JO"),
        ("SATRIX S&P 500 ETF", "STX500.JO"),
        ("1NVEST S&P 500 Index STANLIB Feeder ETF", "ETF500.JO"),
        ("1NVEST S&P 500 STANLIB Feeder Exchange Traded Fund", "ETF500.JO"),
        ("1nvest s&p 500 index stanlib feeder etf", "ETF500.JO"),
    ],
)
def test_sp500_feeder_funds_resolve_from_the_statement_spelling(spelling, ticker):
    resolved = resolve_known_instrument(spelling)
    assert resolved is not None
    assert resolved.ticker == ticker


def test_the_three_sp500_trackers_stay_separate():
    assert resolve_known_instrument("Satrix S&P 500 ETF").ticker == "STX500.JO"
    assert resolve_known_instrument("Sygnia Itrix S&P 500 ETF").ticker == "SYG500.JO"
    assert resolve_known_instrument("10X S&P 500 ETF").ticker == "CSP500.JO"


def test_distinct_funds_do_not_collapse_onto_one_key():
    assert resolve_known_instrument("10X S&P 500 ETF").ticker == "CSP500.JO"
    assert resolve_known_instrument("Sygnia Itrix S&P 500 ETF").ticker == "SYG500.JO"
    assert len({i.ticker for i in KNOWN_INSTRUMENTS.values()}) == len(KNOWN_INSTRUMENTS)


def test_every_etf_region_has_a_benchmark():
    etf_regions = {i.region for i in KNOWN_INSTRUMENTS.values() if i.kind == KIND_ETF}
    assert etf_regions <= set(REGION_BENCHMARKS)


def test_ticker_slot_stays_first_for_index_access():
    resolved = resolve_known_instrument("Naspers Limited")
    assert resolved[0] == "NPN.JO"
    assert resolved[1] == "Technology"


@pytest.mark.parametrize(
    ("mangled", "clean"),
    [
        (
            "10X S&P South Africa Top50 Index ExchangeTraded Fund",
            "10X S&P South Africa Top50 Index Exchange Traded Fund",
        ),
        (
            "10X S&P South Africa Top50 Index Exchange TradedFund",
            "10X S&P South Africa Top50 Index Exchange Traded Fund",
        ),
        (
            "Traded Fund EasyETFs AI World Actively Managed ETF",
            "EasyETFs AI World Actively Managed ETF",
        ),
        ("EasyETFs AI World ActivelyManaged ETF", "EasyETFs AI World Actively Managed ETF"),
        (
            "Satrix MSCI EmergingMarkets ETF",
            "Satrix MSCI Emerging Markets Exchange Traded Fund",
        ),
    ],
)
def test_display_name_replaces_the_parser_mangled_one(mangled, clean):
    assert resolve_known_instrument(mangled).display_name == clean


def test_display_names_are_readable_not_lowercased():
    assert resolve_known_instrument("naspers limited").display_name == "Naspers Limited"
    assert resolve_known_instrument("BHP GROUP").display_name == "BHP Group"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Financial Services", "Financials"),
        ("Communication Services", "Telecommunications"),
        ("Basic Materials", "Materials"),
        ("Consumer Cyclical", "Consumer"),
        ("Consumer Defensive", "Consumer"),
        ("Real Estate", "RealEstate"),
        ("  financial services  ", "Financials"),
        ("Technology", "Technology"),
        ("Utilities", "Utilities"),
    ],
)
def test_normalize_sector_maps_gics_names_to_dashboard_vocabulary(raw, expected):
    assert normalize_sector(raw) == expected


def test_known_stock_sectors_are_already_normalized():
    stock_sectors = {i.sector for i in KNOWN_INSTRUMENTS.values() if i.kind == KIND_STOCK}
    assert stock_sectors == {
        "Technology", "Financials", "Telecommunications", "Materials", "Healthcare",
    }


def test_npn_look_through_note_mentions_prosus_and_tencent():
    note = get_look_through_note("NPN.JO")
    assert note is not None
    assert "Prosus" in note
    assert "Tencent" in note


def test_agl_look_through_note_mentions_the_dual_listing():
    note = get_look_through_note("AGL.JO")
    assert note is not None
    assert "dual-listed" in note


def test_ticker_with_no_look_through_caveat_returns_none():
    assert get_look_through_note("SBK.JO") is None


def test_look_through_lookup_is_case_insensitive():
    assert get_look_through_note("npn.jo") == get_look_through_note("NPN.JO")
