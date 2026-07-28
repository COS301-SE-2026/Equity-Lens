from datetime import datetime, timedelta, timezone
from app.utils.stock_cache import should_refresh_market_data

def test_should_refresh_market_data_when_row_is_stale():
    stale_fetched_at = datetime.now(timezone.utc) - timedelta(hours = 25)
    assert should_refresh_market_data(stale_fetched_at, ttl_hours = 24) is True

def test_should_refresh_market_data_when_row_is_recent():
    fresh_fetched_at = datetime.now(timezone.utc) - timedelta(hours = 3)
    assert should_refresh_market_data(fresh_fetched_at, ttl_hours = 24) is False