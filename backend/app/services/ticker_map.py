from app.services.instruments import is_zar_listed


def canonical_key(ticker: str) -> str:
    return (ticker or "").upper()


def listing_country(ticker: str) -> str:
    return "za" if is_zar_listed(ticker) else "us"
