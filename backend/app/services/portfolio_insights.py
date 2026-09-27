import logging

import numpy as np
import pandas as pd

from app.services.portfolio_risk_service import _returns_frame
from app.services.risk_analytics import repair_unit_switches
from app.utils.stock_cache import get_cached_price_history

logger = logging.getLogger(__name__)

FACTORS = {
    "jse": ("STX40.JO", "the JSE Top 40"),
    "rand": ("ZAR=X", "the rand weakening against the dollar"),
    "gold": ("GC=F", "the gold price"),
    "oil": ("BZ=F", "the oil price"),
}

MIN_WEEKS = 26
CLEAR_LINK_T = 2.0
SHOCK_PCT = 10.0
LIKELY_RANGE_Z = 1.645
LITTLE_EFFECT_PCT = 2.0

SCENARIOS = [
    ("The JSE Top 40 falls 20%", {"jse": -20.0}),
    ("The JSE Top 40 rises 10%", {"jse": 10.0}),
    ("The rand slumps (a dollar costs 15% more)", {"rand": 15.0}),
    ("The oil price jumps 30%", {"oil": 30.0}),
    ("A global sell-off like March 2020", {"jse": -30.0, "rand": 25.0, "oil": -50.0}),
]

def _to_weekly(daily_log: pd.Series) -> pd.Series:
    return daily_log.resample("W-FRI").sum(min_count=1).dropna()


def weekly_log_returns(close: pd.Series) -> pd.Series:
    close = repair_unit_switches(close.dropna())
    close = close[close > 0]
    return _to_weekly(np.log(close).diff().dropna())


def load_factor_returns() -> pd.DataFrame | None:
    columns = {}
    for key, (ticker, _label) in FACTORS.items():
        try:
            history = get_cached_price_history(ticker, "1y", force_live=True)
        except Exception:
            logger.warning("factor history failed for %s", ticker, exc_info=True)
            continue
        if history is None or history.empty or "Close" not in history:
            continue
        columns[key] = weekly_log_returns(history["Close"])

    if not columns:
        return None
    return pd.concat(columns, axis=1, join="inner")


def _pct(log_move: float) -> float:
    return float(np.expm1(log_move) * 100)


def _reaction(t_stat: float, low_pct: float, high_pct: float) -> str:
    if abs(t_stat) >= CLEAR_LINK_T:
        return "clear"
    if max(abs(low_pct), abs(high_pct)) <= LITTLE_EFFECT_PCT:
        return "little"
    return "unclear"


def _scenarios(keys, coef, covariance, sigma2, current_value):
    rows = []
    for name, shocks in SCENARIOS:
        if not all(key in keys for key in shocks):
            continue
        shock = np.zeros(len(coef))
        for key, move in shocks.items():
            shock[keys.index(key) + 1] = np.log1p(move / 100)
        centre = float(shock @ coef)
        spread = LIKELY_RANGE_Z * float(np.sqrt(shock @ covariance @ shock + sigma2))
        effect_pct = _pct(centre)
        rows.append(
            {
                "name": name,
                "effect_pct": round(effect_pct, 2),
                "low_pct": round(_pct(centre - spread), 2),
                "high_pct": round(_pct(centre + spread), 2),
                "effect_value": (
                    round(current_value * effect_pct / 100, 2) if current_value else None
                ),
            }
        )
    return rows

def _align(portfolio: pd.Series, factors: pd.DataFrame) -> pd.DataFrame:
    return factors.join(portfolio.rename("portfolio"), how="inner").dropna()


def attribute_by_holding(
    frame: pd.DataFrame, weights: pd.Series, names: dict[str, str]
) -> list[dict]:
    daily = frame.mul(weights, axis=1)
    simple_total = float(daily.to_numpy().sum())
    total_pct = _pct(float(np.log1p(daily.sum(axis=1)).sum()))
    to_pct = 100.0 if np.isclose(simple_total, 0) else total_pct / simple_total

    rows = [
        {
            "ticker": ticker,
            "name": names.get(ticker, ticker),
            "weight_pct": round(float(weights[ticker]) * 100, 1),
            "return_pct": round(_pct(float(np.log1p(frame[ticker]).sum())), 2),
            "contribution_pct": round(float(daily[ticker].sum()) * to_pct, 2),
        }
        for ticker in frame.columns
    ]
    rows.sort(key=lambda row: row["contribution_pct"], reverse=True)
    return rows

def explain_moves(
    portfolio: pd.Series, factors: pd.DataFrame, current_value: float | None = None
) -> dict:
    keys = list(factors.columns)
    data = _align(portfolio, factors)
    weeks = len(data)
    if weeks < MIN_WEEKS:
        return {
            "available": False,
            "reason": f"Needs {MIN_WEEKS} weeks of shared price history, found {weeks}.",
        }

    y = data["portfolio"].to_numpy()
    x = np.column_stack([np.ones(weeks), data[keys].to_numpy()])
    coef, *_ = np.linalg.lstsq(x, y, rcond=None)

    residuals = y - x @ coef
    sigma2 = residuals @ residuals / (weeks - x.shape[1])
    covariance = sigma2 * np.linalg.pinv(x.T @ x)
    std_err = np.sqrt(np.diag(covariance))
    spread = ((y - y.mean()) ** 2).sum()
    r_squared = 1 - (residuals @ residuals) / spread if spread else 0.0

    total_log = y.sum()
    total_pct = float(np.expm1(total_log) * 100)
    to_pct = 100.0 if np.isclose(total_log, 0) else total_pct / total_log

    shock_log = np.log1p(SHOCK_PCT / 100)
    drivers = []
    for index, key in enumerate(keys, start=1):
        beta = coef[index]
        t_stat = beta / std_err[index] if std_err[index] else 0.0
        factor_log = data[key].sum()
        low_pct = _pct((beta - CLEAR_LINK_T * std_err[index]) * shock_log)
        high_pct = _pct((beta + CLEAR_LINK_T * std_err[index]) * shock_log)
        drivers.append(
            {
                "key": key,
                "ticker": FACTORS[key][0],
                "label": FACTORS[key][1],
                "beta": round(float(beta), 3),
                "sensitivity_pct": round(_pct(beta * shock_log), 2),
                "t_stat": round(float(t_stat), 2),
                "clear": bool(abs(t_stat) >= CLEAR_LINK_T),
                "reaction": _reaction(t_stat, low_pct, high_pct),
                "factor_move_pct": round(float(np.expm1(factor_log) * 100), 2),
                "contribution_pct": round(float(beta * factor_log * to_pct), 2),
            }
        )

    return {
        "available": True,
        "weeks": weeks,
        "shock_pct": SHOCK_PCT,
        "r_squared": round(float(r_squared), 3),
        "total_return_pct": round(total_pct, 2),
        "own_picks_pct": round(float(coef[0] * weeks * to_pct), 2),
        "own_picks_clear": bool(std_err[0] and abs(coef[0] / std_err[0]) >= CLEAR_LINK_T),
        "drivers": drivers,
        "scenarios": _scenarios(keys, coef, covariance, sigma2, current_value),
    }


def build_market_drivers(priced_holdings: list[dict]) -> dict:
    frame, weights = _returns_frame(priced_holdings)
    if frame is None or weights is None:
        return {"available": False, "reason": "Not enough price history for these holdings."}

    factors = load_factor_returns()
    if factors is None:
        return {"available": False, "reason": "Market factor prices could not be loaded."}

    daily = frame.mul(weights, axis=1).sum(axis=1)
    weekly = _to_weekly(np.log1p(daily))
    current_value = sum(h["value"] for h in priced_holdings)
    result = explain_moves(weekly, factors, current_value)
    if not result["available"]:
        return result


    used = _align(weekly, factors).index
    window = frame[(frame.index > used[0] - pd.Timedelta(days=7)) & (frame.index <= used[-1])]
    names = {h.get("ticker"): h["name"] for h in priced_holdings}
    result["holdings"] = attribute_by_holding(window, weights, names)
    result["holdings_return_pct"] = round(
        sum(row["contribution_pct"] for row in result["holdings"]), 2
    )
    return result 
