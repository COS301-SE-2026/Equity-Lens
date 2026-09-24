from __future__ import annotations

import math
from datetime import date
from itertools import pairwise

LAMBDA = 0.94
K_SIGMA = 3.0
MAX_GAP_DAYS = 4
SEED_OBSERVATIONS = 30
MIN_OBSERVATIONS = 60
TRADING_DAYS_PER_YEAR = 252
UNUSUAL_BANDS = ((5.0, "extremely_unusual"), (4.0, "very_unusual"), (3.0, "unusual"))


def annualised_pct(daily_sigma: float) -> float:
   return daily_sigma * math.sqrt(TRADING_DAYS_PER_YEAR) * 100


def log_returns(series: list[tuple[date, float]]) -> list[tuple[date, float]]:
    ordered = sorted((d, p) for d, p in series if p and p > 0)
    out = []
    for (prev_day, prev_price), (day, price) in pairwise(ordered):
        if (day - prev_day).days > MAX_GAP_DAYS:
            continue
        out.append((day, math.log(price / prev_price)))
    return out


def band_for(z: float) -> str | None:
    for threshold, band in UNUSUAL_BANDS:
        if abs(z) >= threshold:
            return band
    return None


def rank_in_period(returns: list[float], r: float) -> int:
   return 1 + sum(1 for v in returns if v * r > 0 and abs(v) > abs(r))


def _seed_variance(returns: list[float]) -> float:
    mean = sum(returns) / len(returns)
    return sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)


def score_series(series: list[tuple[date, float]], k_sigma: float = K_SIGMA) -> dict:
    returns = log_returns(series)
    observations = len(returns)

    if observations < MIN_OBSERVATIONS:
        return {
            "available": False,
            "reason": "insufficient_history",
            "observations": observations,
            "events": [],
        }

    values = [r for _, r in returns]
    variance = _seed_variance(values[:SEED_OBSERVATIONS])
    seed_variance = variance

    events = []
    scored = 0
    sigma = math.sqrt(variance)
    for i in range(SEED_OBSERVATIONS, observations):
        if i > SEED_OBSERVATIONS:
            variance = LAMBDA * variance + (1 - LAMBDA) * values[i - 1] ** 2
        sigma = math.sqrt(variance)
        scored += 1
        if sigma <= 0:
            continue

        day, r = returns[i]
        z = r / sigma
        if abs(z) < k_sigma:
            continue

        events.append({
            "date": day.isoformat(),
            "log_return": round(r, 6),
            "return_pct": round((math.exp(r) - 1) * 100, 2),
            "z_score": round(z, 2),
            "sigma": round(sigma, 6),
            "daily_sigma_pct": round(sigma * 100, 2),
            "rank_in_period": rank_in_period(values, r),
            "period_days": observations,
            "annualised_volatility_pct": round(annualised_pct(sigma), 2),
            "variance": variance,
            "direction": "up" if r > 0 else "down",
        })

    return {
        "available": True,
        "reason": None,
        "observations": observations,
        "scored_days": scored,
        "first_scored_date": returns[SEED_OBSERVATIONS][0].isoformat(),
        "last_date": returns[-1][0].isoformat(),
        "seed_variance": seed_variance,
        "annualised_volatility_pct": round(annualised_pct(sigma), 2),
        "k_sigma": k_sigma,
        "decay": LAMBDA,
        "events": events,
    }