from app.services.instruments import is_zar_listed

_JO_SUFFIX = ".JO"


def query_symbol(ticker: str) -> str:
    if is_zar_listed(ticker):
        return ticker[: -len(_JO_SUFFIX)]
    return ticker


def canonical_key(ticker: str) -> str:
    return (ticker or "").upper()


def storage_map(tickers: list[str]) -> dict[str, str]:
    return {query_symbol(t).upper(): canonical_key(t) for t in tickers}


def match_entity(symbol: str | None, wanted: dict[str, str]) -> str | None:
    if not symbol:
        return None
    sym = symbol.upper()
    return wanted.get(sym) or wanted.get(sym.split(".")[0])
