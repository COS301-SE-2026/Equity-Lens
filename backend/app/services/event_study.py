from __future__ import annotations

import math
from datetime import date
from itertools import pairwise

import numpy as np

from app.services.event_detection import MAX_GAP_DAYS

ESTIMATION_START = -120
ESTIMATION_END = -21
EVENT_START = -5
EVENT_END = 10

MIN_OBSERVATIONS = 60
CONFIDENCE_Z = 1.96
AFTER_EVENT_MIN_DAYS = 5


def aligned_simple_returns(
    stock_series: list[tuple[date, float]], market_series: list[tuple[date, float]]
) -> tuple[list[date], np.ndarray, np.ndarray]:
    stock = {d: p for d, p in stock_series if p and p > 0}
    market = {d: p for d, p in market_series if p and p > 0}

    days = []
    r_i = []
    r_m = []
    for prev, day in pairwise(sorted(set(stock) & set(market))):
        if (day - prev).days > MAX_GAP_DAYS:
            continue
        days.append(day)
        r_i.append(stock[day] / stock[prev] - 1)
        r_m.append(market[day] / market[prev] - 1)

    return days, np.array(r_i), np.array(r_m)


def run(
    stock_series: list[tuple[date, float]],
    market_series: list[tuple[date, float]],
    event_day: date,
) -> dict:
    if event_day not in {d for d, p in stock_series if p and p > 0}:
        return {"available": False, "reason": "event_date_not_in_history", "observations": 0}

    days, r_i, r_m = aligned_simple_returns(stock_series, market_series)
    try:
        pivot = days.index(event_day)
    except ValueError:
        return {"available": False, "reason": "no_overlapping_benchmark", "observations": 0}

    #both ends inclusive, so a full window is t-120..t-21, 100 days
    est_lo = max(pivot + ESTIMATION_START, 0)
    est_hi = pivot + ESTIMATION_END + 1
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

    alpha_se = sigma * math.sqrt(
        1 / observations + float(np.mean(x)) ** 2 / float(np.sum((x - np.mean(x)) ** 2))
    )
    alpha_t = alpha / alpha_se if alpha_se > 0 else None

    estimation_ar = y - beta * x
    sigma_ar = float(np.sqrt(np.sum(estimation_ar ** 2) / (observations - 1)))

    window_lo = max(pivot + EVENT_START, 0)
    window_hi = min(pivot + EVENT_END + 1, len(days))

    abnormal: list[dict] = []
    running = 0.0
    for k, i in enumerate(range(window_lo, window_hi), start=1):
        ar = float(r_i[i] - beta * r_m[i])
        running += ar
        band = CONFIDENCE_Z * sigma_ar * math.sqrt(k)
        abnormal.append({
            "date": days[i].isoformat(),
            "offset": i - pivot,
            "stock_return_pct": round(float(r_i[i]) * 100, 2),
            "market_return_pct": round(float(r_m[i]) * 100, 2),
            "abnormal_return_pct": round(ar * 100, 2),
            "cumulative_abnormal_return_pct": round(running * 100, 2),
            "car_lower_pct": round((running - band) * 100, 2),
            "car_upper_pct": round((running + band) * 100, 2),
            "significant": abs(running) > band,
        })

    stock_pct = round(float(r_i[pivot]) * 100, 2)
    market_part = round(beta * float(r_m[pivot]) * 100, 2)
    decomposition = {
        "stock_return_pct": stock_pct,
        "market_return_pct": round(float(r_m[pivot]) * 100, 2),
        "beta": round(beta, 4),
        "market_component_pct": market_part,
        "company_component_pct": round(stock_pct - market_part, 2),
    }

    after = [row for row in abnormal if row["offset"] >= 1]
    after_event = None
    if len(after) >= AFTER_EVENT_MIN_DAYS:
        last = after[-1]
        after_event = {
            "days": last["offset"],
            "car_pct": last["cumulative_abnormal_return_pct"],
            "lower_pct": last["car_lower_pct"],
            "upper_pct": last["car_upper_pct"],
            "significant": last["significant"],
        }

    return {
        "available": True,
        "reason": None,
        "observations": observations,
        "alpha": round(alpha, 6),
        "alpha_se": round(alpha_se, 6),
        "alpha_t": round(alpha_t, 2) if alpha_t is not None else None,
        "beta": round(beta, 4),
        "r_squared": round(r_squared, 4),
        "residual_sigma": round(sigma, 6),
        "sigma_ar": round(sigma_ar, 6),
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
        "decomposition": decomposition,
        "after_event": after_event,
    }