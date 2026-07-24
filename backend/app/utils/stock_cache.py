import boto3
import pandas as pd
import yfinance as yf
from io import BytesIO
import pickle
from datetime import datetime, timezone
from botocore.config import Config
from app.config import settings
from app.database import SessionLocal
from app.models.market_data import MarketData

S3_BUCKET = "market-data-bucket-equitylens"
s3 = boto3.client("s3", config = Config(connect_timeout = 2, read_timeout = 2, retries = {"max_attempts": 1}))

def _get_latest_market_row(ticker:str, data_type:str):
    db = SessionLocal()
    try:
        return(db.query(MarketData).filter(MarketData.ticker == ticker.upper(), MarketData.data_type == data_type).order_by(MarketData.fetched_at.desc()).first())
    finally:
        db.close()

def _build_single_row_frame(row: MarketData) -> pd.DataFrame:
    if row is None:
        return pd.DataFrame()

    price = None
    if row.price is not None:
        price = row.price
    if price is None:
        return pd.DataFrame()

    ts = row.fetched_at or datetime.now(timezone.utc)
    return pd.DataFrame([{"Open": float(price),"High": float(price),"Low":float(price),"Close": float(price), "Volume": float(price)}], index=[pd.Timestamp(ts)],)

def get_cached_price_history(ticker: str, period: str = "1y") -> pd.DataFrame:
    ticker = ticker.upper()
    local_row = _get_latest_market_row(ticker, "price_history")
    if local_row is not None:
        local_df = _build_single_row_frame(local_row)
        if not local_df.empty:
            print(f"Local price hit: {ticker}")
            return local_df
    cache_key = f"stock_prices/{ticker}.csv"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=cache_key)
        df = pd.read_csv(BytesIO(obj["Body"].read()), index_col=0, parse_dates=True)
        print(f"S3 Cache hit: {ticker}")
        return df
    except Exception as e:
        print(f"S3 Cache miss for {ticker}: {e}")
        if settings.allow_live_market_fallback:
            ticker_obj = yf.Ticker(ticker)
            df = ticker_obj.history(period=period, interval="1d", auto_adjust=True)
            return df if not df.empty else pd.DataFrame()
        return pd.DataFrame()
def get_cached_fundamentals(ticker: str) -> dict:
    ticker = ticker.upper()
    local_row = _get_latest_market_row(ticker,"fundamentals")

    if local_row is not None and local_row.payload:
        print(f"Local fundamentals hit: {ticker}")
        return local_row.payload
    
    cache_key = f"statements/{ticker}.pkl"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=cache_key)
        data = pickle.loads(obj["Body"].read())
        print(f"S3 Statements cache hit: {ticker}")
        return data
    except Exception as e:
        print(f"S3 Statements cache miss for {ticker}: {e}")
        if settings.allow_live_market_fallback:
            ticker_obj = yf.Ticker(ticker)
            data = {
                "info": ticker_obj.info or {},
                "balance_sheet": ticker_obj.balance_sheet,
                "financials": ticker_obj.financials,
            }
            return data
        return {
            "info": {},
            "balance_sheet": pd.DataFrame(),
            "financials": pd.DataFrame(),
        }
        
