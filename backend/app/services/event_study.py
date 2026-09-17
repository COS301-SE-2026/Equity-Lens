from __future__ import annotations

import math
from datetime import date
from itertools import pairwise

import numpy as np

ESTIMATION_START = -120
ESTIMATION_END = -21
EVENT_START = -5
EVENT_END = 10

MIN_OBSERVATIONS = 60
CONFIDENCE_Z = 1.96


def _aligned_returns(
    stock: dict[date, float], market: dict[date, float]
) -> tuple[list[date], np.ndarray, np.ndarray]:
    days = sorted(set(stock) & set(market))
    return (
        days,
        np.array([stock[d] for d in days]),
        np.array([market[d] for d in days]),
    )


def log_returns_by_day(series: list[tuple[date, float]]) -> dict[date, float]:
    ordered = sorted((d, p) for d, p in series if p and p > 0)
    return {
        day: math.log(price / prev_price)
        for (_, prev_price), (day, price) in pairwise(ordered)
    }


def run(
    stock_series: list[tuple[date, float]],
    market_series: list[tuple[date, float]],
    event_day: date,
) -> dict:
    stock = log_returns_by_day(stock_series)
    market = log_returns_by_day(market_series)
    days, r_i, r_m = _aligned_returns(stock, market)

    if event_day not in stock:
        return {"available": False, "reason": "event_date_not_in_history", "observations": 0}
    try:
        pivot = days.index(event_day)
    except ValueError:
        return {"available": False, "reason": "no_overlapping_benchmark", "observations": 0}

    est_lo = max(pivot + ESTIMATION_START, 0)
    est_hi = pivot + ESTIMATION_END
    if est_hi <= est_lo:
        return {"available": False, "reason": "insufficient_history", "observations": 0}

    x = r_m[est_lo:est_hi]
    y = r_i[est_lo:est_hi]
    observations = len(x)
    if observations < MIN_OBSERVATIONS:
        return {
            "available": False,
            "reason": "insufficient_history",
            "observations": observations,
        }

    variance = float(np.var(x, ddof=1))
    if variance <= 0:
        return {
            "available": False,
            "reason": "benchmark_did_not_move",
            "observations": observations,
        }

    beta = float(np.cov(y, x, ddof=1)[0][1] / variance)
    alpha = float(np.mean(y) - beta * np.mean(x))

    residuals = y - (alpha + beta * x)
    sigma = float(np.sqrt(np.sum(residuals ** 2) / (observations - 2)))
    total = float(np.sum((y - np.mean(y)) ** 2))
    r_squared = float(1 - np.sum(residuals ** 2) / total) if total > 0 else 0.0

    window_lo = max(pivot + EVENT_START, 0)
    window_hi = min(pivot + EVENT_END + 1, len(days))

    abnormal = []
    running = 0.0
    for k, i in enumerate(range(window_lo, window_hi), start=1):
        ar = float(r_i[i] - (alpha + beta * r_m[i]))
        running += ar
        band = CONFIDENCE_Z * sigma * math.sqrt(k)
        abnormal.append({
            "date": days[i].isoformat(),
            "offset": i - pivot,
            "stock_return_pct": round((math.exp(float(r_i[i])) - 1) * 100, 2),
            "market_return_pct": round((math.exp(float(r_m[i])) - 1) * 100, 2),
            "abnormal_return_pct": round(ar * 100, 2),
            "cumulative_abnormal_return_pct": round(running * 100, 2),
            "car_lower_pct": round((running - band) * 100, 2),
            "car_upper_pct": round((running + band) * 100, 2),
            "significant": abs(running) > band,
        })

    return {
        "available": True,
        "reason": None,
        "observations": observations,
        "alpha": round(alpha, 6),
        "beta": round(beta, 4),
        "r_squared": round(r_squared, 4),
        "residual_sigma": round(sigma, 6),
        "estimation_window": {
            "from": days[est_lo].isoformat(),
            "to": days[est_hi - 1].isoformat(),
            "offsets": [est_lo - pivot, est_hi - 1 - pivot],
        },
        "event_window": {
            "from": days[window_lo].isoformat(),
            "to": days[window_hi - 1].isoformat(),
            "length": window_hi - window_lo,
        },
        "abnormal_returns": abnormal,
    }