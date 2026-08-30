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
_YFINANCE_GLOBAL_COOLDOWN_UNTIL: datetime | None = None
YFINANCE_RATE_LIMIT_COOLDOWN_MINUTES = 30

def _is_rate_limit_error(exc: Exception) -> bool:
    message = str(exc)
    return "Too Many Requests" in message or "Rate limited" in message

def _trip_yfinance_global_cooldown() -> None:
    global _YFINANCE_GLOBAL_COOLDOWN_UNTIL
    _YFINANCE_GLOBAL_COOLDOWN_UNTIL = datetime.now(timezone.utc) + timedelta(minutes=YFINANCE_RATE_LIMIT_COOLDOWN_MINUTES)
    print(f"Yahoo rate limit hit - pausing all yfinance calls until {_YFINANCE_GLOBAL_COOLDOWN_UNTIL.isoformat()}")

def _yfinance_globally_cooling_down() -> bool:
    return _YFINANCE_GLOBAL_COOLDOWN_UNTIL is not None and datetime.now(timezone.utc) < _YFINANCE_GLOBAL_COOLDOWN_UNTIL

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

def _get_latest_fetched_at(ticker: str) -> datetime | None:
    db = SessionLocal()
    try:
        latest_record = (
            db.query(MarketData)
            .filter(MarketData.ticker == ticker)
            .order_by(MarketData.date.desc(), MarketData.fetched_at.desc())
            .first()
        )
        return latest_record.fetched_at if latest_record is not None else None
    finally:
        db.close()

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
    if _yfinance_globally_cooling_down():
        print(f"Skipping Yahoo fetch for {ticker} - global rate-limit cooldown active")
        return pd.DataFrame()
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
            if _is_rate_limit_error(exc):
                _trip_yfinance_global_cooldown()
                break
    return pd.DataFrame()

def _refresh_price_history(ticker: str, period: str, force_live: bool = False) -> pd.DataFrame:
    if settings.alpha_vantage_api_key and not ticker.upper().endswith(".JO"):
        try:
            history = _fetch_from_alpha_vantage(ticker)
            print(f"Alpha Vantage refresh: {ticker}")
            _save_price_history(ticker,history)
            return _load_local_price_history(ticker)
        except Exception as exc:
            print(f"Alpha Vantage refresh failed for {ticker}: {exc}")

    if settings.allow_live_market_fallback or force_live:
        try:
            history = _fetch_from_yfinance(ticker, period)
            if not history.empty:
                print(f"Yahoo refresh: {ticker}")
                _save_price_history(ticker, history)
                return _load_local_price_history(ticker)
        except Exception as exc:
            print(f"Yahoo refresh failed for {ticker}: {exc}")
    return pd.DataFrame()

def get_cached_price_history(ticker: str, period: str = "1y", force_live: bool = False) -> pd.DataFrame:
    ticker = ticker.upper()
    history = _load_local_price_history(ticker)
    if not history.empty:
            if not should_refresh_market_data(_get_latest_fetched_at(ticker)):
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
        refreshed = _refresh_price_history(ticker, period, force_live=force_live)
        if not refreshed.empty:
            _PRICE_REFRESH_COOLDOWN_UNTIL.pop(ticker, None)
            return refreshed
        _PRICE_REFRESH_COOLDOWN_UNTIL[ticker] = datetime.now(timezone.utc) + timedelta(minutes=PRICE_REFRESH_COOLDOWN_MINUTES)
        return history
    finally:
        _REFRESH_LOCKS.discard(ticker)

# batched version of get_cached_price_history, one yf.download() call for
# all cache-miss tickers instead of a separate .history() call per ticker
def get_cached_price_histories(tickers: list[str], period: str = "1y", force_live: bool = False) -> dict[str, pd.DataFrame]:
    tickers = [t.upper() for t in tickers]
    results: dict[str, pd.DataFrame] = {}
    needs_refresh: list[str] = []

    for ticker in tickers:
        history = _load_local_price_history(ticker)
        results[ticker] = history
        if not history.empty:
            if not should_refresh_market_data(_get_latest_fetched_at(ticker)):
                print(f"Local price hit: {ticker}")
                continue

        cooldown_until = _PRICE_REFRESH_COOLDOWN_UNTIL.get(ticker)
        if cooldown_until and datetime.now(timezone.utc) < cooldown_until:
            print(f"Skipping {ticker} price refresh - cooldown")
            continue
        if ticker in _REFRESH_LOCKS:
            continue
        needs_refresh.append(ticker)

    if not needs_refresh:
        return results

    # Alpha Vantage doesn't support batching
    av_tickers = [t for t in needs_refresh if settings.alpha_vantage_api_key and not t.endswith(".JO")]
    yf_tickers = [t for t in needs_refresh if t not in av_tickers]

    for ticker in av_tickers:
        _REFRESH_LOCKS.add(ticker)
        try:
            try:
                history = _fetch_from_alpha_vantage(ticker)
                print(f"Alpha Vantage refresh: {ticker}")
                _save_price_history(ticker, history)
                refreshed = _load_local_price_history(ticker)
                if not refreshed.empty:
                    _PRICE_REFRESH_COOLDOWN_UNTIL.pop(ticker, None)
                    results[ticker] = refreshed
                    continue
            except Exception as exc:
                print(f"Alpha Vantage refresh failed for {ticker}: {exc}")
            if settings.allow_live_market_fallback or force_live:
                yf_tickers.append(ticker)
        finally:
            _REFRESH_LOCKS.discard(ticker)

    if yf_tickers and (settings.allow_live_market_fallback or force_live):
        if _yfinance_globally_cooling_down():
            print(f"Skipping batched Yahoo fetch for {yf_tickers} - global rate-limit cooldown active")
        else:
            for ticker in yf_tickers:
                _REFRESH_LOCKS.add(ticker)
            try:
                symbol_map = {t: (t if t.endswith(".JO") else f"{t}.JO") for t in yf_tickers}
                symbols = list(symbol_map.values())
                try:
                    data = yf.download(
                        symbols, period=period, interval="1d", auto_adjust=True,
                        group_by="ticker", threads=True, progress=False,
                    )
                except Exception as exc:
                    print(f"Batched Yahoo fetch failed: {exc}")
                    if _is_rate_limit_error(exc):
                        _trip_yfinance_global_cooldown()
                    data = pd.DataFrame()

                for ticker, yf_symbol in symbol_map.items():
                    try:
                        ticker_history = data if len(symbols) == 1 else (
                            data[yf_symbol] if yf_symbol in data.columns.get_level_values(0) else pd.DataFrame()
                        )
                        if ticker_history is not None and not ticker_history.empty:
                            ticker_history = ticker_history[["Open", "High", "Low", "Close", "Volume"]].copy()
                            ticker_history["Prev Close"] = ticker_history["Close"].shift(1)
                            ticker_history = ticker_history.dropna(subset=["Close"])
                            if not ticker_history.empty:
                                print(f"Yahoo refresh: {ticker}")
                                _save_price_history(ticker, ticker_history)
                                _PRICE_REFRESH_COOLDOWN_UNTIL.pop(ticker, None)
                                results[ticker] = _load_local_price_history(ticker)
                                continue
                    except Exception as exc:
                        print(f"Processing batched Yahoo data failed for {ticker}: {exc}")
                    _PRICE_REFRESH_COOLDOWN_UNTIL[ticker] = datetime.now(timezone.utc) + timedelta(minutes=PRICE_REFRESH_COOLDOWN_MINUTES)
            finally:
                for ticker in yf_tickers:
                    _REFRESH_LOCKS.discard(ticker)

    return results

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
            balance_sheet_copy = balance_sheet_copy.astype(object)
            balance_sheet_copy = balance_sheet_copy.where(pd.notna(balance_sheet_copy), None)
            balance_sheetjson = balance_sheet_copy.to_dict()

        financials_json = None
        if financials is not None and not financials.empty:
            financials_copy = financials.copy()
            financials_copy.columns = financials_copy.columns.astype(str)
            financials_copy = financials_copy.astype(object)
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
    
    if _yfinance_globally_cooling_down():
        print(f"Skipping {ticker} fundamentals fetch - global rate limit")
        return {"info": {}, "balance_shet": pd.DataFrame(), "financials": pd.DataFrame()}
    
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
            if _is_rate_limit_error(exc):
                _FUNDAMENTALS_RATE_LIMITED_UNTIL[ticker] = datetime.now(timezone.utc) + timedelta(minutes=10)
                _trip_yfinance_global_cooldown()
                break
    return {"info": {}, "balance_sheet": pd.DataFrame(), "financials": pd.DataFrame()}
