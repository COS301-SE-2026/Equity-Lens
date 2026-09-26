import numpy as np
import pandas as pd

from app.services.risk_analytics import (
    MIN_HISTORY_DAYS,
    TRADING_DAYS_PER_YEAR,
    single_ticker_daily_returns,
)

VAR_CONFIDENCE = 0.95
MIN_VALUE_COVERAGE = 0.6

SCORE_PARTS = {
    "max_drawdown_pct": (0.25, 5.0, 40.0),
    "var_pct": (0.20, 1.0, 5.0),
    "downside_deviation_pct": (0.20, 5.0, 30.0),
    "hhi": (0.20, 0.10, 0.50),
    "top_contribution_pct": (0.15, 20.0, 60.0),
}

PART_LABELS = {
    "max_drawdown_pct": "historical drawdown",
    "var_pct": "bad-day loss risk",
    "downside_deviation_pct": "downside volatility",
    "hhi": "concentration",
    "top_contribution_pct": "reliance on a single risk driver",
}

RISK_LEVELS = [(75, "High"), (55, "Moderate-High"), (35, "Moderate"), (0, "Low")]

HHI_WELL_DIVERSIFIED = 0.15
HHI_HIGHLY_CONCENTRATED = 0.25
DRAWDOWN_COMFORT_PCT = 20.0
TOP_TWO_FLAG_PCT = 50.0
ELEVATED_RATIO = 1.25
LOWER_RATIO = 0.8


def _scale(value: float, low: float, high: float) -> float:
    return max(0.0, min(100.0, (value - low) / (high - low) * 100))


def _risk_level(score: float) -> str:
    for floor, label in RISK_LEVELS:
        if score >= floor:
            return label
    return RISK_LEVELS[-1][1]


def _concentration(priced_holdings: list[dict]) -> dict:
    total = sum(h["value"] for h in priced_holdings)
    ranked = sorted(priced_holdings, key=lambda h: h["value"], reverse=True)
    weights = [h["value"] / total for h in ranked] if total else []
    hhi = sum(w * w for w in weights)

    if hhi < HHI_WELL_DIVERSIFIED:
        assessment = "Well diversified"
    elif hhi < HHI_HIGHLY_CONCENTRATED:
        assessment = "Moderately concentrated"
    else:
        assessment = "Highly concentrated"

    return {
        "hhi": round(hhi, 3),
        "largest_name": ranked[0]["name"] if ranked else None,
        "largest_pct": round(weights[0] * 100, 1) if weights else 0.0,
        "top_two_pct": round(sum(weights[:2]) * 100, 1),
        "assessment": assessment,
    }


def _returns_frame(priced_holdings: list[dict]) -> tuple[pd.DataFrame | None, pd.Series | None]:
    total = sum(h["value"] for h in priced_holdings)
    if not total:
        return None, None

    per_ticker: dict[str, pd.Series] = {}
    covered: dict[str, float] = {}
    for h in priced_holdings:
        ticker = h.get("ticker")
        if not ticker:
            continue
        if ticker not in per_ticker:
            returns = single_ticker_daily_returns(ticker)
            if returns is None:
                continue
            per_ticker[ticker] = returns
        covered[ticker] = covered.get(ticker, 0.0) + h["value"]

    covered_value = sum(covered.values())
    if not per_ticker or covered_value / total < MIN_VALUE_COVERAGE:
        return None, None

    frame = pd.concat(per_ticker, axis=1, join="inner").dropna()
    if len(frame) < MIN_HISTORY_DAYS:
        return None, None

    weights = pd.Series(covered)[frame.columns] / covered_value
    return frame, weights


def _drawdown(portfolio: pd.Series, current_value: float) -> dict:
    growth = (1 + portfolio).cumprod()
    drawdowns = growth / growth.cummax() - 1
    trough_day = drawdowns.idxmin()
    peak_day = growth.loc[:trough_day].idxmax()
    scale = current_value / growth.iloc[-1]

    return {
        "max_drawdown_pct": round(float(drawdowns.min()) * 100, 2),
        "peak_value": round(float(growth[peak_day] * scale), 2),
        "trough_value": round(float(growth[trough_day] * scale), 2),
        "peak_date": pd.Timestamp(peak_day).date().isoformat(),
        "trough_date": pd.Timestamp(trough_day).date().isoformat(),
    }


def _contributions(frame: pd.DataFrame, weights: pd.Series, names: dict[str, str]) -> list[dict]:
    covariance = frame.cov().to_numpy() * TRADING_DAYS_PER_YEAR
    w = weights.to_numpy()
    portfolio_variance = float(w @ covariance @ w)
    if portfolio_variance <= 0:
        return []

    shares = w * (covariance @ w) / portfolio_variance
    rows = [
        {
            "ticker": ticker,
            "name": names.get(ticker, ticker),
            "weight_pct": round(float(weight) * 100, 1),
            "contribution_pct": round(float(share) * 100, 1),
        }
        for ticker, weight, share in zip(frame.columns, w, shares, strict=True)
    ]
    rows.sort(key=lambda row: row["contribution_pct"], reverse=True)

    for index, row in enumerate(rows):
        ratio = row["contribution_pct"] / row["weight_pct"] if row["weight_pct"] else 0.0
        if row["contribution_pct"] < 0:
            row["flag"] = "Diversifier"
        elif index == 0:
            row["flag"] = "Main risk driver"
        elif ratio >= ELEVATED_RATIO:
            row["flag"] = "Elevated"
        elif ratio <= LOWER_RATIO:
            row["flag"] = "Lower"
        else:
            row["flag"] = "In line"
    return rows


def _flags(concentration: dict, drawdown: dict, contributions: list[dict]) -> list[str]:
    flags = []
    if concentration["top_two_pct"] >= TOP_TWO_FLAG_PCT:
        flags.append(f"Two holdings make up {concentration['top_two_pct']:.0f}% of the portfolio.")
    if concentration["hhi"] >= HHI_HIGHLY_CONCENTRATED:
        flags.append("The portfolio is highly concentrated by value.")
    if abs(drawdown["max_drawdown_pct"]) >= DRAWDOWN_COMFORT_PCT:
        flags.append(
            f"The largest historical fall ({abs(drawdown['max_drawdown_pct']):.1f}%) is bigger "
            f"than a {DRAWDOWN_COMFORT_PCT:.0f}% comfort range."
        )
    if contributions:
        top = contributions[0]
        if top["weight_pct"] and top["contribution_pct"] / top["weight_pct"] >= ELEVATED_RATIO:
            flags.append(
                f"{top['name']} carries {top['contribution_pct']:.0f}% of total risk "
                f"but is only {top['weight_pct']:.0f}% of the value."
            )
    return flags


def build_risk_assessment(priced_holdings: list[dict]) -> dict:
    concentration = _concentration(priced_holdings)
    frame, weights = _returns_frame(priced_holdings)
    if frame is None or weights is None:
        return {
            "available": False,
            "reason": (
                f"Needs at least {MIN_HISTORY_DAYS} days of shared price history covering "
                f"{MIN_VALUE_COVERAGE * 100:.0f}% of the portfolio's value."
            ),
            "concentration": concentration,
        }

    current_value = sum(h["value"] for h in priced_holdings)
    portfolio = frame.mul(weights, axis=1).sum(axis=1)

    var_pct = max(0.0, -float(np.percentile(portfolio, (1 - VAR_CONFIDENCE) * 100)) * 100)
    downside_pct = float(
        np.sqrt((np.minimum(portfolio, 0) ** 2).mean() * TRADING_DAYS_PER_YEAR) * 100
    )
    volatility_pct = float(portfolio.std() * np.sqrt(TRADING_DAYS_PER_YEAR) * 100)
    drawdown = _drawdown(portfolio, current_value)
    names = {h.get("ticker"): h["name"] for h in priced_holdings}
    contributions = _contributions(frame, weights, names)

    readings = {
        "max_drawdown_pct": abs(drawdown["max_drawdown_pct"]),
        "var_pct": var_pct,
        "downside_deviation_pct": downside_pct,
        "hhi": concentration["hhi"],
        "top_contribution_pct": contributions[0]["contribution_pct"] if contributions else 0.0,
    }
    parts = [
        {
            "key": key,
            "label": PART_LABELS[key],
            "reading": round(readings[key], 3),
            "weight": weight,
            "points": round(weight * _scale(readings[key], low, high), 1),
        }
        for key, (weight, low, high) in SCORE_PARTS.items()
    ]
    score = round(sum(part["points"] for part in parts))

    return {
        "available": True,
        "score": score,
        "level": _risk_level(score),
        "parts": parts,
        "var": {
            "confidence_pct": round(VAR_CONFIDENCE * 100),
            "pct": round(var_pct, 2),
            "value": round(current_value * var_pct / 100, 2),
        },
        "downside_deviation_pct": round(downside_pct, 2),
        "volatility_pct": round(volatility_pct, 2),
        "drawdown": drawdown,
        "concentration": concentration,
        "contributions": contributions,
        "flags": _flags(concentration, drawdown, contributions),
        "history_days": len(frame),
    }