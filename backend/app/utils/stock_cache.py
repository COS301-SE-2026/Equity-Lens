import boto3
import pandas as pd
import yfinance as yf
from io import BytesIO

S3_BUCKET = "market-data-bucket-equitylens"
s3 = boto3.client("s3")

def get_cached_price_history(ticker: str, period: str = "1y") -> pd.DataFrame:
    ticker = ticker.upper()
    cache_key = f"stock_prices/{ticker}.csv"
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=cache_key)
        df = pd.read_csv(BytesIO(obj["Body"].read()), index_col=0, parse_dates=True)
        print(f"Cache hit: {ticker}")
        return df
    except Exception as e:
        print(f"Cache miss for {ticker}, fetching from Yahoo: {e}")
        ticker_obj = yf.Ticker(ticker)
        df = ticker_obj.history(period=period, interval="1d", auto_adjust=True)
        return df if not df.empty else pd.DataFrame()
