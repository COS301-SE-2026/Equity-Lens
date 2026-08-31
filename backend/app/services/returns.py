import logging
from datetime import date

logger = logging.getLogger(__name__)

DAYS_IN_YEAR = 365.0
XIRR_MAX = 100
XIRR_TOL = 1e-6


def _xnpv(rate: float, flows: list[tuple[date, float]], t0: date) -> float:
    x = 0.0
    for when, amount in flows:
        yrs = (when - t0).days / DAYS_IN_YEAR
        x += amount / (1.0 + rate) ** yrs
    return x


def _xnpv_derivative(rate: float, flows: list[tuple[date, float]], t0: date) -> float:
    x = 0.0
    for when, amount in flows:
        yrs = (when - t0).days / DAYS_IN_YEAR
        if yrs == 0:
            continue
        x += -yrs * amount / (1.0 + rate) ** (yrs + 1)
    return x


def _xirr_bisect(flows: list[tuple[date, float]], t0: date) -> float | None:
    lo, hi = -0.9999, 10.0
    try:
        f_lo, f_hi = _xnpv(lo, flows, t0), _xnpv(hi, flows, t0)
    except (OverflowError, ZeroDivisionError):
        return None
    if f_lo == 0:
        return lo
    if f_hi == 0:
        return hi
    if (f_lo > 0) == (f_hi > 0):
        return None

    for _ in range(200):
        mid = (lo + hi) / 2
        try:
            f_mid = _xnpv(mid, flows, t0)
        except (OverflowError, ZeroDivisionError):
            return None
        if abs(f_mid) < XIRR_TOL:
            return mid
        if (f_mid > 0) == (f_lo > 0):
            lo, f_lo = mid, f_mid
        else:
            hi = mid
    return mid


def xirr(flows: list[tuple[date, float]], guess: float = 0.1) -> float | None:
    if len(flows) < 2:
        return None
    if not any(a > 0 for _, a in flows) or not any(a < 0 for _, a in flows):
        return None

    t0 = min(d for d, _ in flows)
    rate = guess
    for _ in range(XIRR_MAX):
        try:
            f = _xnpv(rate, flows, t0)
            fprime = _xnpv_derivative(rate, flows, t0)
        except (OverflowError, ZeroDivisionError):
            break
        if fprime == 0:
            break
        next_rate = rate - f / fprime
        if next_rate <= -1.0:
            break
        if abs(next_rate - rate) < XIRR_TOL:
            return next_rate * 100
        rate = next_rate
    else:
        return rate * 100

    fallback = _xirr_bisect(flows, t0)
    if fallback is None:
        logger.warning("xirr did not converge for cash flow series starting %s", t0)
        return None
    return fallback * 100


def time_weighted_return_pct(
    snapshots: list[tuple[date, float]], flows: list[tuple[date, float]]
) -> float | None:
    if len(snapshots) < 2:
        return None

    snapshots = sorted(snapshots)
    cumulative = 1.0
    for (prev_date, prev_value), (this_date, this_value) in zip(snapshots, snapshots[1:]):
        if prev_value <= 0:
            continue
        period_flow = sum(amt for d, amt in flows if prev_date < d <= this_date)
        sub_return = (this_value - period_flow) / prev_value - 1.0
        cumulative *= 1.0 + sub_return

    return (cumulative - 1.0) * 100


def _walk_average_cost(transactions: list[dict]) -> dict[str, dict]:
    positions: dict[str, dict] = {}

    for txn in sorted(transactions, key=lambda t: (t["ticker"], t["date"])):
        ticker = txn["ticker"]
        pos = positions.setdefault(ticker, {"qty": 0.0, "cost": 0.0, "realised": 0.0})

        if txn["side"] == "buy":
            pos["qty"] += txn["quantity"]
            pos["cost"] += txn["value_zar"]
            continue

        sell_qty = txn["quantity"]
        if sell_qty > pos["qty"]:
            logger.warning(
                "sale exceeds held quantity for %s (selling %s, held %s), clamping",
                ticker, sell_qty, pos["qty"],
            )
            sell_qty = pos["qty"]

        if sell_qty <= 0 or pos["qty"] <= 0:
            continue

        avg_cost = pos["cost"] / pos["qty"]
        cost_basis_sold = avg_cost * sell_qty
        proceeds = txn["value_zar"] * (sell_qty / txn["quantity"]) if txn["quantity"] else 0.0

        pos["realised"] += proceeds - cost_basis_sold
        pos["qty"] -= sell_qty
        pos["cost"] -= cost_basis_sold

    return positions


def average_cost_realised_gain(transactions: list[dict]) -> float:
    positions = _walk_average_cost(transactions)
    return sum(pos["realised"] for pos in positions.values())


def average_cost_positions(transactions: list[dict]) -> dict[str, dict]:
    positions = _walk_average_cost(transactions)
    return {ticker: {"qty": pos["qty"], "cost": pos["cost"]} for ticker, pos in positions.items()}


def pct_return(gain: float, base: float) -> float | None:
    if not base:
        return None
    return gain / base * 100