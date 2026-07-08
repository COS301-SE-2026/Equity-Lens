import yfinance as yf
import boto3
import pandas as pd
from io import BytesIO

S3_BUCKET = 'market-data-bucket-equitylens'
S3_KEY = 'market_data/vt_1y.parquet'

s3 = boto3.client('s3')

def get_market_returns():
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
        df = pd.read_csv(BytesIO(obj['Body'].read()), index_col=0)
        return df["returns"]
    except Exception as e:
        print(f"S3 cache miss, downloading live: {e}")
        ticker = yf.Ticker("VT")
        hist = ticker.history(period="1y", interval="1d", auto_adjust=True)
        return hist['Close'].pct_change().dropna()