
import numpy as np

N_SIMULATIONS = 2000
MAX_CHART_POINTS = 24


def simulate_goal(
    current_value: float,
    target_value: float | None,
    years: float,
    monthly_contribution: float,
    expected_return_pct: float,
    volatility_pct: float,
    rng_seed: int | None = None,
) -> dict:
    if years <= 0 or current_value < 0 or (target_value is not None and target_value <= 0):
        return {"probability_pct": None, "months": 0, "path_percentiles": [], "median_final_value": None}

    months = max(1, round(years * 12))
    mu = expected_return_pct / 100
    sigma = max(0.0, volatility_pct / 100)
    dt = 1 / 12

    rng = np.random.default_rng(rng_seed)
    drift = (mu - 0.5 * sigma**2) * dt
    monthly_log_returns = rng.normal(loc=drift, scale=sigma * np.sqrt(dt), size=(N_SIMULATIONS, months))

    sample_every = max(1, months // MAX_CHART_POINTS)
    values = np.full(N_SIMULATIONS, current_value, dtype=float)
    path_percentiles = []
    for month in range(months):
        values = values * np.exp(monthly_log_returns[:, month]) + monthly_contribution
        values = np.maximum(values, 0.0)
        if month % sample_every == 0 or month == months - 1:
            path_percentiles.append({
                "month": month + 1,
                "p10": round(float(np.percentile(values, 10)), 2),
                "p50": round(float(np.percentile(values, 50)), 2),
                "p90": round(float(np.percentile(values, 90)), 2),
            })

    probability_pct = float((values >= target_value).mean() * 100) if target_value is not None else None

    return {
        "probability_pct": round(probability_pct, 1) if probability_pct is not None else None,
        "months": months,
        "path_percentiles": path_percentiles,
        "median_final_value": round(float(np.percentile(values, 50)), 2),
    }
