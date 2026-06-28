import boto3
import pandas as pd
from io import BytesIO

S3_BUCKET = 'market-data-bucket-equitylens'
S3_KEY = 'market_data/gspc_1y.parquet'

s3 = boto3.client('s3')

def get_market_returns():
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
        return pd.read_parquet(BytesIO(obj['Body'].read()))
    except Exception as e:
        print(f"S3 cache miss, downloading live: {e}")
        import yfinance as yf
        ticker = yf.Ticker("^GSPC")
        hist = ticker.history(period="1y", interval="1d", auto_adjust=True)
        return hist['Close'].pct_change().dropna()