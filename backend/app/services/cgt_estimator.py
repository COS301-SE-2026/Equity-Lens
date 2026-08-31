import logging

from app.services.returns import average_cost_positions

logger = logging.getLogger(__name__)

TAX_YEAR_LABEL = "2026/2027"
ANNUAL_EXCLUSION_ZAR = 50_000.0
INCLUSION_RATE_INDIVIDUAL = 0.40

ACCOUNT_TYPE_USD = "usd"
ACCOUNT_TYPE_TFSA = "tfsa"
ACCOUNT_TYPE_RA = "retirement_annuity"
CGT_EXEMPT_REASONS = {
    ACCOUNT_TYPE_TFSA: "tfsa_exempt",
    ACCOUNT_TYPE_RA: "retirement_annuity_exempt",
}


def _assumptions() -> dict:
    return {
        "tax_year": TAX_YEAR_LABEL,
        "annual_exclusion": ANNUAL_EXCLUSION_ZAR,
        "inclusion_rate": INCLUSION_RATE_INDIVIDUAL,
        "cost_basis_method": "average_cost",
    }


def _unavailable(reason: str) -> dict:
    return {
        "available": False,
        "reason": reason,
        "assumptions": _assumptions(),
        "net_unrealised_gain": None,
        "taxable_capital_gain": None,
        "assessed_capital_loss": None,
        "holdings_from_statement_only": [],
    }


def _holding_base_cost(holding: dict, positions: dict[str, dict]) -> tuple[float, bool]:
    key = holding.get("txn_key")
    pos = positions.get(key) if key else None
    if pos and pos["qty"] > 0:
        return pos["cost"], False
    return holding["total_cost"], True


def estimate_cgt(
    account_type: str | None,
    priced_holdings: list[dict],
    instrument_txns: list[dict],
) -> dict:
    if account_type in CGT_EXEMPT_REASONS:
        return _unavailable(CGT_EXEMPT_REASONS[account_type])

    if account_type is None:
        return _unavailable("account_type_unknown")

    if not priced_holdings:
        return _unavailable("no_holdings")

    if any(not h["priced_live"] for h in priced_holdings):
        return _unavailable("unpriced_holdings")

    positions = average_cost_positions(instrument_txns)

    net_gain = 0.0
    from_statement_only = []
    for h in priced_holdings:
        base_cost, flagged = _holding_base_cost(h, positions)
        if flagged and base_cost <= 0:
            return _unavailable("cost_basis_incomplete")
        net_gain += h["value"] - base_cost
        if flagged:
            from_statement_only.append(h["ticker"])

    if net_gain < 0:
        return {
            "available": True,
            "reason": None,
            "assumptions": _assumptions(),
            "net_unrealised_gain": round(net_gain, 2),
            "taxable_capital_gain": None,
            "assessed_capital_loss": round(-net_gain, 2),
            "holdings_from_statement_only": from_statement_only,
        }

    taxable_gain = max(0.0, net_gain - ANNUAL_EXCLUSION_ZAR) * INCLUSION_RATE_INDIVIDUAL
    return {
        "available": True,
        "reason": None,
        "assumptions": _assumptions(),
        "net_unrealised_gain": round(net_gain, 2),
        "taxable_capital_gain": round(taxable_gain, 2),
        "assessed_capital_loss": None,
        "holdings_from_statement_only": from_statement_only,
    }