import pandas as pd
import yfinance as yf
from datetime import datetime, timezone, timedelta
import requests
from app.config import settings
from app.database import SessionLocal
from app.models.market_data import MarketData

_REFRESH_LOCKS = set()

def should_refresh_market_data(last_fetched_at, ttl_hours: int | None = None) -> bool:
    if ttl_hours is None:
        ttl_hours = settings.market_data_refresh_ttl_hours

    if last_fetched_at is None:
        return True
    
    if isinstance(last_fetched_at, str):
        last_fetched_at = datetime.fromisoformat(last_fetched_at.replace("Z","+00:00"))

    if last_fetched_at.tzinfo is None:
        last_fetched_at = last_fetched_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    return (now - last_fetched_at) > timedelta(hours=ttl_hours)

def _load_local_price_history(ticker:str) -> pd.DataFrame:
    db = SessionLocal()
    try:
        rows = (db.query(MarketData)
               .filter(MarketData.ticker == ticker.upper())
               .order_by(MarketData.date.asc())
               .all())
    finally:
        db.close()

    if not rows:
        return pd.DataFrame()
    records = []
    for index, row in enumerate(rows):
        records.append({
            "Open": float(row.open),
            "High": float(row.high),
            "Low": float(row.low),
            "Close": float(row.close),
            "Volume": float(row.volume),
            "Prev Close": float(row.prev_close)
        })
    df = pd.DataFrame(records, index=pd.DatetimeIndex([pd.Timestamp(row.date) for row in rows]))
    df.index.name = "Date"
    return df

def _save_price_history(ticker: str, history: pd.DataFrame) -> None:
    if history.empty:
        return
    db = SessionLocal()
    try:
        for timestamp, row in history.iterrows():
            trade_date = (
                timestamp.to_pydatetime().date()
                if hasattr(timestamp, "to_pydatetime")
                else timestamp.date()
            )
            existing = (
                db.query(MarketData)
                .filter(MarketData.ticker == ticker.upper(), MarketData.date == trade_date)
                .first()
            )
            if existing is None:
                db.add(
                    MarketData(
                        ticker= ticker.upper(),
                        date = trade_date,
                        open = float(row["Open"]),
                        high = float(row["High"]),
                        low = float(row["Low"]),
                        close = float(row["Close"]),
                        prev_close = float(row["Prev Close"]) if "Prev Close" in row and not pd.isna(row["Prev Close"]) else float(row["Close"]),
                        volume = float(row["Volume"] or 0),
                        fetched_at = datetime.now(timezone.utc),
                    )
                )
            else:
                existing.open = float(row["Open"])
                existing.high = float(row["High"])
                existing.low = float(row["Low"])
                existing.close = float(row["Close"])
                existing.prev_close = float(row["Prev Close"]) if "Prev Close" in row and not pd.isna(row["Prev Close"]) else float(row["Close"])
                existing.volume = float(row["Volume"] or 0)
                existing.fetched_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()

def _fetch_from_alpha_vantage(ticker: str) -> pd.DataFrame:
    url = (
        "https://www.alphavantage.co/query"
        f"?function=TIME_SERIES_DAILY_ADJUSTED&symbol={ticker}&outputsize=compact&apikey={settings.alpha_vantage_api_key}"
    )
    response = requests.get(url, timeout = 10)
    response.raise_for_status()
    payload = response.json()
    series = payload.get("Time Series (Daily)")
    if not series:
        raise ValueError(payload.get("Note") or payload.get("Information") or "Alpha Vantage returned no daily series")

    rows = []
    previous_close = None
    for raw_date in sorted(series.keys()):
        item = series[raw_date]
        close = float(item.get("5. adjusted close") or item.get("4. close"))
        open_price = float(item.get("1. open"))
        high = float(item.get("2. high"))
        low = float(item.get("3. low"))
        volume = float(item.get("6. volume") or 0)

        row = {
            "Open": open_price,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume,
            "Prev Close": previous_close,
        }
        rows.append(row)
        previous_close = close
    df = pd.DataFrame(rows, index=pd.DatetimeIndex([pd.Timestamp(raw_date) for raw_date in sorted(series.keys())]))
    df.index.name = "Date"
    return df

def _fetch_from_yfinance(ticker: str, period: str) -> pd.DataFrame:
    ticker_obj = yf.Ticker(ticker)
    history = ticker_obj.history(period=period, interval="1d", auto_adjust=True)
    if history.empty:
        return pd.DataFrame()
    history = history.rename(
        columns = {
            "Open": "Open",
            "High": "High",
            "Low": "Low",
            "Close": "Close",
            "Volume": "Volume",
        }
    )
    history = history[["Open", "High", "Low", "Close", "Volume"]].copy()
    history["Prev Close"] = history["Close"].shift(1)
    return history

def _refresh_price_history(ticker: str, period: str) -> pd.DataFrame:
    try:
        if settings.alpha_vantage_api_key:
            history = _fetch_from_alpha_vantage(ticker)
            print(f"Alpha Vantage refresh: {ticker}")
            _save_price_history(ticker,history)
            return _load_local_price_history(ticker)
    except Exception as exc:
        print(f"Alpha Vantage refresh failed for {ticker}: {exc}")

    if settings.allow_live_market_fallback:
        try:
            history = _fetch_from_yfinance(ticker, period)
            if not history.empty:
                print(f"Yahoo refresh: {ticker}")
                _save_price_history(ticker, history)
                return _load_local_price_history(ticker)
        except Exception as exc:
            print(f"Yahoo refresh failed for {ticker}: {exc}")
    return pd.DataFrame()

def get_cached_price_history(ticker: str, period: str = "1y") -> pd.DataFrame:
    ticker = ticker.upper()
    history = _load_local_price_history(ticker)
    if not history.empty:
            latest_fetched_at = None
            db = SessionLocal()
            try:
                latest_record = (
                    db.query(MarketData)
                    .filter(MarketData.ticker == ticker)
                    .order_by(MarketData.date.desc(), MarketData.fetched_at.desc())
                    .first()
                )
                if latest_record is not None:
                    latest_fetched_at = latest_record.fetched_at
            finally:
                db.close()
            if not should_refresh_market_data(latest_fetched_at):
                print(f"Local price hit: {ticker}")
                return history
    if ticker in _REFRESH_LOCKS:
        return history

    _REFRESH_LOCKS.add(ticker)
    try:
        refreshed = _refresh_price_history(ticker, period)
        if not refreshed.empty:
            return refreshed
        return history
    finally:
        _REFRESH_LOCKS.discard(ticker)
    
def get_cached_fundamentals(ticker: str) -> dict:
    ticker = ticker.upper()
    if not settings.allow_live_market_fallback:
        return {
            "info": {},
            "balance_sheet": pd.DataFrame(),
            "financials": pd.DataFrame(),
        }
    try:
        ticker_obj = yf.Ticker(ticker)
        return{
            "info": ticker_obj.info or {},
            "balance_sheet": ticker_obj.balance_sheet,
            "financials": ticker_obj.financials,
        }
    except Exception as exc:
        print(f"Yahoo fundamentals fetch failed for {ticker}: {exc}")
        return {"info": {}, "balance_sheet": pd.DataFrame(), "financials": pd.DataFrame()}
        
