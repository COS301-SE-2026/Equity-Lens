import time
import pandas as pd
import yfinance as yf
from datetime import datetime, timezone, timedelta
import requests
from app.config import settings
from app.database import SessionLocal
from app.models.market_data import MarketData, FundamentalsCache

_REFRESH_LOCKS = set()
_PRICE_REFRESH_COOLDOWN_UNTIL: dict[str, datetime] = {}
PRICE_REFRESH_COOLDOWN_MINUTES = 10
#weekly - comfortable time as eases rates on yfinance
#and also short enough to where a company can release financials
#on a random day mid-week and wont be long until the refresh to serve fresh data
FUNDAMENTALS_TTL_HOURS = 24 * 7

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
    for  row in rows:
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
            volume = float(row["Volume"]) if not pd.isna(row["Volume"]) else 0.0
            prev_close = float(row["Prev Close"]) if "Prev Close" in row and not pd.isna(row["Prev Close"]) else float(row["Close"])
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
                        prev_close = prev_close,
                        volume = volume,
                        fetched_at = datetime.now(timezone.utc),
                    )
                )
            else:
                existing.open = float(row["Open"])
                existing.high = float(row["High"])
                existing.low = float(row["Low"])
                existing.close = float(row["Close"])
                existing.prev_close = prev_close
                existing.volume = volume
                existing.fetched_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()

def _fetch_from_alpha_vantage(ticker: str) -> pd.DataFrame:
    response = requests.get(
        "https://www.alphavantage.co/query",
        params={
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker,
            "outputsize": "compact",
            "apikey": settings.alpha_vantage_api_key,
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    series = payload.get("Time Series (Daily)")
    if not series:
        raise ValueError(payload.get("Note") or payload.get("Information") or "Alpha Vantage returned no daily series")

    rows = []
    previous_close = None
    for raw_date in sorted(series.keys()):
        item = series[raw_date]
        close = float(item.get("4. close"))
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
    #mirrors get_cached_fundamentals, try .JO first then fallback to plain
    candidates = [ticker] if ticker.endswith(".JO") else [f"{ticker}.JO", ticker]
    for candidate in candidates:
        try:
            ticker_obj = yf.Ticker(candidate)
            history = ticker_obj.history(period=period, interval="1d", auto_adjust=True)
            if not history.empty:
                
                history = history[["Open", "High", "Low", "Close", "Volume"]].copy()
                history["Prev Close"] = history["Close"].shift(1)
                return history
        except Exception as exc:
            print(f"Yahoo history fetch failed for {candidate}: {exc}")
    return pd.DataFrame()

def _refresh_price_history(ticker: str, period: str) -> pd.DataFrame:
    if settings.alpha_vantage_api_key and not ticker.upper().endswith(".JO"):
        try:
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

    cooldown_until = _PRICE_REFRESH_COOLDOWN_UNTIL.get(ticker)
    if cooldown_until and datetime.now(timezone.utc) < cooldown_until:
        print(f"Skipping {ticker} price refresh - cooldown")
        return history

    _REFRESH_LOCKS.add(ticker)
    try:
        refreshed = _refresh_price_history(ticker, period)
        if not refreshed.empty:
            _PRICE_REFRESH_COOLDOWN_UNTIL.pop(ticker, None)
            return refreshed
        _PRICE_REFRESH_COOLDOWN_UNTIL[ticker] = datetime.now(timezone.utc) + timedelta(minutes=PRICE_REFRESH_COOLDOWN_MINUTES)
        return history
    finally:
        _REFRESH_LOCKS.discard(ticker)

def _load_cached_fundamentals(ticker: str) -> dict | None:
    db = SessionLocal()
    try:
        row = db.query(FundamentalsCache).filter(FundamentalsCache.ticker == ticker.upper()).first()
        if row is None:
            return None
        if should_refresh_market_data(row.fetched_at, ttl_hours=FUNDAMENTALS_TTL_HOURS):
            return None
        balance_sheet = pd.DataFrame(row.balance_sheet) if row.balance_sheet else pd.DataFrame()
        financials = pd.DataFrame(row.financials) if row.financials else pd.DataFrame()
        return {
            "info": row.info or {},
            "balance_sheet": balance_sheet,
            "financials": financials,
        }
    finally:
        db.close()

def _save_fundamentals(ticker: str, info: dict, balance_sheet: pd.DataFrame, financials: pd.DataFrame) -> None:
    db = SessionLocal()
    try:
        existing = db.query(FundamentalsCache).filter(FundamentalsCache.ticker == ticker.upper()).first()

        balance_sheetjson = None
        if balance_sheet is not None and not balance_sheet.empty:
            balance_sheet_copy = balance_sheet.copy()
            balance_sheet_copy.columns = balance_sheet_copy.columns.astype(str)
            balance_sheet_copy = balance_sheet_copy.where(pd.notna(balance_sheet_copy), None)
            balance_sheetjson = balance_sheet_copy.to_dict()

        financials_json = None
        if financials is not None and not financials.empty:
            financials_copy = financials.copy()
            financials_copy.columns = financials_copy.columns.astype(str)
            financials_copy = financials_copy.where(pd.notna(financials_copy), None)
            financials_json = financials_copy.to_dict()

        if existing is None:
            db.add(
                FundamentalsCache(
                    ticker = ticker.upper(),
                    info = info,
                    balance_sheet = balance_sheetjson,
                    financials = financials_json,
                    fetched_at = datetime.now(timezone.utc),
                )
            )
        else:
            existing.info = info
            existing.balance_sheet = balance_sheetjson
            existing.financials = financials_json
            existing.fetched_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()

_FUNDAMENTALS_RATE_LIMITED_UNTIL: dict[str, datetime] = {}
    
def get_cached_fundamentals(ticker: str) -> dict:
    ticker = ticker.upper()
    if not settings.allow_live_market_fallback:
        return {
            "info": {},
            "balance_sheet": pd.DataFrame(),
            "financials": pd.DataFrame(),
        }
    cached = _load_cached_fundamentals(ticker)
    if cached is not None:
        print(f"Fundamentals cache hit: {ticker}")
        return cached
    cooldown_until = _FUNDAMENTALS_RATE_LIMITED_UNTIL.get(ticker)
    if cooldown_until and datetime.now(timezone.utc) < cooldown_until:
        print(f"Skipping {ticker} fundamentals fetch - cooldown")
        return {"info": {}, "balance_sheet": pd.DataFrame(), "financials": pd.DataFrame()}
    ticker_candidates = [ticker] if ticker.endswith(".JO") else [f"{ticker}.JO", ticker]
    for candidate in ticker_candidates:
        try:
            ticker_obj = yf.Ticker(candidate)
            info = ticker_obj.info or {}
            time.sleep(0.5)
            balance_sheet = ticker_obj.balance_sheet
            time.sleep(0.5)
            financials = ticker_obj.financials
            if info or (balance_sheet is not None and not balance_sheet.empty) or (financials is not None and not financials.empty):
                _save_fundamentals(ticker, info, balance_sheet, financials)
                return{
                    "info": info,
                    "balance_sheet": balance_sheet,
                    "financials": financials,
                }
        except Exception as exc:
            print(f"Yahoo fundamentals fetch failed for {candidate}: {exc}")
            if "Too Many Requests" in str(exc) or "Rate limited" in str(exc):
                _FUNDAMENTALS_RATE_LIMITED_UNTIL[ticker] = datetime.now(timezone.utc) + timedelta(minutes=10)
                break
    return {"info": {}, "balance_sheet": pd.DataFrame(), "financials": pd.DataFrame()}
