import re
from typing import NamedTuple


class Instrument(NamedTuple):
    ticker: str
    sector: str
    kind: str
    region: str
    display_name: str

KIND_STOCK = "stock"
KIND_ETF = "etf"
REGION_SA = "South Africa"
REGION_US = "United States"
REGION_GLOBAL = "Global"
REGION_EM = "Emerging Markets"
REGION_UNKNOWN = "Unclassified"
EXPOSURE_SA_EQUITY = "SA Equity"
EXPOSURE_US_EQUITY = "US Equity"
EXPOSURE_GLOBAL_EQUITY = "Global Equity"
EXPOSURE_EM_EQUITY = "Emerging Market Equity"
EXPOSURE_UNKNOWN_FUND = "Unclassified Fund"

_STOCKS = {
    "Naspers Limited": ("NPN.JO", "Technology", REGION_SA),
    "Standard Bank Group": ("SBK.JO", "Financial Services", REGION_SA),
    "Capitec Bank Holdings": ("CPI.JO", "Financial Services", REGION_SA),
    "MTN Group": ("MTN.JO", "Communication Services", REGION_SA),
    "FirstRand": ("FSR.JO", "Financial Services", REGION_SA),
    "Anglo American": ("AGL.JO", "Basic Materials", REGION_SA),
    "BHP Group": ("BHG.JO", "Basic Materials", REGION_SA),
    "Remgro": ("REM.JO", "Financial Services", REGION_SA),
    "Aspen Pharmacare Holdings": ("APN.JO", "Healthcare", REGION_SA),
}

_ETFS = {
    "10X S&P South Africa Top50 Index Exchange Traded Fund": (
        "CTOP50.JO", EXPOSURE_SA_EQUITY, REGION_SA
    ),
    "10X S&P 500 Exchange Traded Fund": ("CSP500.JO", EXPOSURE_US_EQUITY, REGION_US),
    "Satrix 40 Exchange Traded Fund": ("STX40.JO", EXPOSURE_SA_EQUITY, REGION_SA),
    "Sygnia Itrix Top 40 Exchange Traded Fund": ("SYGT40.JO", EXPOSURE_SA_EQUITY, REGION_SA),
    "Satrix Nasdaq 100 Exchange Traded Fund": ("STXNDQ.JO", EXPOSURE_US_EQUITY, REGION_US),
    "Sygnia Itrix S&P 500 Exchange Traded Fund": ("SYG500.JO", EXPOSURE_US_EQUITY, REGION_US),
    "Satrix MSCI World Exchange Traded Fund": ("STXWDM.JO", EXPOSURE_GLOBAL_EQUITY, REGION_GLOBAL),
    "Satrix MSCI Emerging Markets Exchange Traded Fund": (
        "STXEMG.JO", EXPOSURE_EM_EQUITY, REGION_EM
    ),
    "EasyETFs AI World Actively Managed ETF": ("EASYAI.JO", EXPOSURE_GLOBAL_EQUITY, REGION_GLOBAL),
}

def is_zar_listed(ticker: str | None) -> bool:
    return bool(ticker) and ticker.upper().endswith(".JO")


REGION_BENCHMARKS = {
    REGION_SA: ("STX40.JO", "Satrix 40 (JSE Top 40 proxy)", "ZAR"),
    REGION_US: ("SPY", "S&P 500 (SPY ETF proxy)", "USD"),
    REGION_GLOBAL: ("URTH", "MSCI World", "USD"),
    REGION_EM: ("EEM", "MSCI EM", "USD"),
}

_FUND_NOISE = sorted(
    [
        "exchangetradedfund",
        "activelymanaged",
        "exchange",
        "traded",
        "ametf",
        "actively",
        "managed",
        "index",
        "feeder",
        "unittrust",
        "portfolio",
        "funds",
        "fund",
        "etf",
    ],
    key=len,
    reverse=True,
)

_FUND_MARKERS = ("exchange traded fund", "etf", "index", "unit trust", "feeder", "fund")

_SECTOR_ALIASES = {
    "financial services": "Financials",
    "communication services": "Telecommunications",
    "basic materials": "Materials",
    "consumer cyclical": "Consumer",
    "consumer defensive": "Consumer",
    "real estate": "RealEstate",
}

def normalize_sector(sector: str) -> str:
    return _SECTOR_ALIASES.get(sector.strip().lower(), sector)

def _canonical(instrument_name: str) -> str:
    name = re.sub(r"[^0-9a-z&]+", "", (instrument_name or "").lower())
    for noise in _FUND_NOISE:
        name = name.replace(noise, "")
    return name

def _build_table(rows: dict, kind: str) -> dict[str, Instrument]:
    return {
        _canonical(name): Instrument(ticker, normalize_sector(sector), kind, region, name)
        for name, (ticker, sector, region) in rows.items()
    }

KNOWN_INSTRUMENTS: dict[str, Instrument] = {
    **_build_table(_STOCKS, KIND_STOCK),
    **_build_table(_ETFS, KIND_ETF),
}

def resolve_known_instrument(instrument_name: str) -> Instrument | None:
    return KNOWN_INSTRUMENTS.get(_canonical(instrument_name))

def looks_like_fund(instrument_name: str) -> bool:
    name = " ".join((instrument_name or "").split()).lower()
    return any(marker in name for marker in _FUND_MARKERS)