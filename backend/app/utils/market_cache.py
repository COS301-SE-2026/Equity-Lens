import yfinance as yf
import boto3
import pandas as pd
from io import BytesIO
from botocore.config import Config
from app.config import settings
from app.database import SessionLocal
from app.models.market_data import MarketData
S3_BUCKET = 'market-data-bucket-equitylens'
S3_KEY = 'market_data/vt_1y.parquet'

s3 = boto3.client('s3', config = Config(connect_timeout = 2,read_timeouts = 2,retries ={"max_attempts":1}))

def get_market_returns():
    db = SessionLocal()
    try:
        row = (db.query(MarketData).filter(MarketData.ticker == "VT", MarketData.data_type == 'benchmark_returns').order_by(MarketData.fetched_at.desc()).first())
    finally:
        db.close()

    if row is not None and row.payload:
        payload = row.payload
        if isinstance(payload, dict) and 'returns' in payload:
            values = payload['returns']
            return pd.Series(values, dtype='float64')
        
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
        df = pd.read_csv(BytesIO(obj['Body'].read()), index_col=0)
        return df["returns"]
    except Exception as e:
        print(f"Market returns miss: {e}")
        if settings.allow_live_market_fallback:
            ticker = yf.Ticker("VT")
            hist = ticker.history(period="1y", interval="1d", auto_adjust=True)
            return hist['Close'].pct_change().dropna()
        return pd.Series(dtype="float64")