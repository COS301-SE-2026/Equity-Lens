import logging

import numpy as np
import pandas as pd

from app.indicators.beta import calculate_beta
from app.utils.stock_cache import get_cached_price_history

logger = logging.getLogger(__name__)

TRADING_DAYS_PER_YEAR = 252
MIN_HISTORY_DAYS = 30


def single_ticker_daily_returns(ticker: str, period: str = "1y") -> pd.Series | None:
    try:
        history = get_cached_price_history(ticker, period=period)
    except Exception as exc:
        logger.warning("price history fetch failed for %s: %s", ticker, exc)
        return None
    if history is None or history.empty or "Close" not in history:
        return None
    returns = history["Close"].dropna().pct_change().dropna()
    return returns if not returns.empty else None


def portfolio_daily_returns(priced_holdings: list[dict], period: str = "1y") -> pd.Series | None:
    total_value = sum(h["value"] for h in priced_holdings)
    if not total_value:
        return None

    per_ticker: dict[str, pd.Series] = {}
    for h in priced_holdings:
        ticker = h.get("ticker")
        if not ticker:
            continue
        returns = single_ticker_daily_returns(ticker, period=period)
        if returns is not None:
            per_ticker[ticker] = returns

    covered_value = sum(h["value"] for h in priced_holdings if h.get("ticker") in per_ticker)
    if not per_ticker or covered_value / total_value < 0.6:
        return None

    weights = {t: h["value"] / covered_value for h in priced_holdings for t in [h.get("ticker")] if t in per_ticker}
    frame = pd.concat(per_ticker, axis=1, join="inner").dropna()
    if len(frame) < MIN_HISTORY_DAYS:
        return None

    return sum(frame[ticker] * weight for ticker, weight in weights.items())


def shadow_portfolio_daily_returns(period: str = "1y") -> pd.Series | None:
    equity = single_ticker_daily_returns("STX40.JO", period=period)
    bonds = single_ticker_daily_returns("STXGOV.JO", period=period)
    if equity is None or bonds is None:
        return None

    equity, bonds = equity.align(bonds, join="inner")
    if len(equity) < MIN_HISTORY_DAYS:
        return None

    return equity * 0.7 + bonds * 0.3


def annualized_return_pct(daily_returns: pd.Series) -> float:
    mean_daily = daily_returns.mean()
    return float((1 + mean_daily) ** TRADING_DAYS_PER_YEAR - 1) * 100


def annualized_volatility_pct(daily_returns: pd.Series) -> float:
    return float(daily_returns.std() * np.sqrt(TRADING_DAYS_PER_YEAR)) * 100


def portfolio_beta(portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float | None:
    aligned_portfolio, aligned_benchmark = portfolio_returns.align(benchmark_returns, join="inner")
    if len(aligned_portfolio) < MIN_HISTORY_DAYS:
        return None
    return float(calculate_beta(aligned_portfolio.values, aligned_benchmark.values))
