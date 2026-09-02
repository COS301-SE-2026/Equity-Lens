import logging
from dataclasses import dataclass

from app.services.instruments import KIND_ETF

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class HealthConfig:

    weight_sector_concentration: float
    weight_single_position: float
    weight_breadth: float
    concentration_low: float
    concentration_high: float
    hhi_well_spread: float
    breadth_target_n: float

WEIGHT_MIN = 0.05
WEIGHT_MAX = 0.70
CONCENTRATION_PCT_MIN = 10.0
CONCENTRATION_PCT_MAX = 70.0
HHI_TARGET_MIN = 0.05
HHI_TARGET_MAX = 0.50
BREADTH_TARGET_MIN = 3.0
BREADTH_TARGET_MAX = 20.0

WEIGHT_SUM_TOLERANCE = 1e-6


@dataclass(frozen=True)
class HealthPreset:
    key: str
    name: str
    description: str
    config: HealthConfig


PRESET_EQUITYLENS = "equitylens"
PRESETS: dict[str, HealthPreset] = {
    PRESET_EQUITYLENS: HealthPreset(
        key=PRESET_EQUITYLENS,
        name="EquityLens default",
        description=(
            "A general-purpose structural risk yardstick with no assumption about your "
            "strategy. Sector spread carries the most weight, and 25% in one holding is "
            "where concentration starts counting against you."
        ),
        config=HealthConfig(
            weight_sector_concentration=0.40,
            weight_single_position=0.35,
            weight_breadth=0.25,
            concentration_low=25,
            concentration_high=45,
            hhi_well_spread=0.15,
            breadth_target_n=8,
        ),
    ),
    "capital_preservation": HealthPreset(
        key="capital_preservation",
        name="Capital preservation",
        description=(
            "For a book whose job is not to lose money. Every threshold is stricter than "
            "the default: a position is flagged from 15% of book, and full marks need "
            "roughly eight evenly-weighted sectors and twelve effective positions."
        ),
        config=HealthConfig(
            weight_sector_concentration=0.40,
            weight_single_position=0.30,
            weight_breadth=0.30,
            concentration_low=15,
            concentration_high=30,
            hhi_well_spread=0.12,
            breadth_target_n=12,
        ),
    ),
    "income": HealthPreset(
        key="income",
        name="Income / dividend",
        description=(
            "Dividend books cluster in financials, REITs, telcos and utilities by design, "
            "so sector spread is weighted lower and its bar is set wider. Single-position "
            "risk carries more weight instead: a dividend cut hurts most when one payer "
            "dominates the income."
        ),
        config=HealthConfig(
            weight_sector_concentration=0.25,
            weight_single_position=0.40,
            weight_breadth=0.35,
            concentration_low=20,
            concentration_high=40,
            hhi_well_spread=0.22,
            breadth_target_n=10,
        ),
    ),
    "balanced": HealthPreset(
        key="balanced",
        name="Balanced",
        description=(
            "The default's thresholds with the three factors weighted almost equally - no "
            "single factor can carry or sink the score on its own."
        ),
        config=HealthConfig(
            weight_sector_concentration=0.34,
            weight_single_position=0.33,
            weight_breadth=0.33,
            concentration_low=25,
            concentration_high=45,
            hhi_well_spread=0.15,
            breadth_target_n=8,
        ),
    ),
    "growth": HealthPreset(
        key="growth",
        name="Growth",
        description=(
            "Accepts that chasing growth means leaning into fewer sectors, so the sector "
            "and single-position bars move out. Breadth carries the most weight of any "
            "preset - the failure mode of a growth book is one holding going to zero, and "
            "that is exactly what effective-N measures."
        ),
        config=HealthConfig(
            weight_sector_concentration=0.30,
            weight_single_position=0.30,
            weight_breadth=0.40,
            concentration_low=30,
            concentration_high=50,
            hhi_well_spread=0.25,
            breadth_target_n=6,
        ),
    ),
    "concentrated": HealthPreset(
        key="concentrated",
        name="Concentrated / high conviction",
        description=(
            "For a deliberately small book of high-conviction positions. The loosest "
            "thresholds available - four effective positions scores full marks, and a "
            "holding is only 'high concentration' past 60% of book. The percentages "
            "themselves are still shown; this preset stops the score repeating a choice "
            "you already made on purpose."
        ),
        config=HealthConfig(
            weight_sector_concentration=0.30,
            weight_single_position=0.35,
            weight_breadth=0.35,
            concentration_low=35,
            concentration_high=60,
            hhi_well_spread=0.35,
            breadth_target_n=4,
        ),
    ),
}

DEFAULT_CONFIG = PRESETS[PRESET_EQUITYLENS].config
WEIGHT_SECTOR_CONCENTRATION = DEFAULT_CONFIG.weight_sector_concentration
WEIGHT_SINGLE_POSITION = DEFAULT_CONFIG.weight_single_position
WEIGHT_BREADTH = DEFAULT_CONFIG.weight_breadth
CONCENTRATION_LOW = DEFAULT_CONFIG.concentration_low
CONCENTRATION_HIGH = DEFAULT_CONFIG.concentration_high
HHI_WELL_SPREAD = DEFAULT_CONFIG.hhi_well_spread
HHI_FULLY_CONCENTRATED = 1.0
BREADTH_TARGET_N = DEFAULT_CONFIG.breadth_target_n

BUCKET_OTHER = "Other"

CONFIG_FIELDS = (
    "weight_sector_concentration",
    "weight_single_position",
    "weight_breadth",
    "concentration_low",
    "concentration_high",
    "hhi_well_spread",
    "breadth_target_n",
)


def config_to_dict(config: HealthConfig) -> dict:
    return {field: getattr(config, field) for field in CONFIG_FIELDS}


def _bounded(name: str, value, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a number") from exc
    if number != number or number in (float("inf"), float("-inf")):
        raise ValueError(f"{name} must be a finite number")
    if not low <= number <= high:
        raise ValueError(f"{name} must be between {low} and {high}")
    return number


def config_from_dict(raw: dict, base: HealthConfig | None = None) -> HealthConfig:
    base = base or DEFAULT_CONFIG
    unknown = set(raw) - set(CONFIG_FIELDS)
    if unknown:
        raise ValueError(f"unknown config field(s): {', '.join(sorted(unknown))}")

    values = config_to_dict(base)
    for field in CONFIG_FIELDS:
        if field in raw and raw[field] is not None:
            values[field] = raw[field]

    weights = {
        field: _bounded(field, values[field], WEIGHT_MIN, WEIGHT_MAX)
        for field in ("weight_sector_concentration", "weight_single_position", "weight_breadth")
    }
    total = sum(weights.values())
    if abs(total - 1.0) > WEIGHT_SUM_TOLERANCE:
        raise ValueError(f"the three weights must sum to 1.0 (got {total:.4f})")

    pct_min, pct_max = CONCENTRATION_PCT_MIN, CONCENTRATION_PCT_MAX
    low = _bounded("concentration_low", values["concentration_low"], pct_min, pct_max)
    high = _bounded("concentration_high", values["concentration_high"], pct_min, pct_max)
    if low >= high:
        raise ValueError("concentration_low must be below concentration_high")

    return HealthConfig(
        **weights,
        concentration_low=low,
        concentration_high=high,
        hhi_well_spread=_bounded(
            "hhi_well_spread", values["hhi_well_spread"], HHI_TARGET_MIN, HHI_TARGET_MAX
        ),
        breadth_target_n=_bounded(
            "breadth_target_n", values["breadth_target_n"], BREADTH_TARGET_MIN, BREADTH_TARGET_MAX
        ),
    )


def preset_config(key: str | None) -> HealthConfig:
    preset = PRESETS.get(key or "")
    if preset is None:
        if key:
            logger.warning("unknown health preset %r, falling back to %s", key, PRESET_EQUITYLENS)
        return DEFAULT_CONFIG
    return preset.config


def presets_payload() -> list[dict]:
    return [
        {
            "key": p.key,
            "name": p.name,
            "description": p.description,
            "config": config_to_dict(p.config),
        }
        for p in PRESETS.values()
    ]


def matching_preset_key(config: HealthConfig) -> str | None:
    for preset in PRESETS.values():
        if preset.config == config:
            return preset.key
    return None


def _clamp10(value: float) -> float:
    return max(0.0, min(10.0, value))


def _round1(value: float) -> float:
    return round(value, 1)


def _hhi(weights: list[float]) -> float:
    return sum(w * w for w in weights)


def _sector_weights(priced_holdings: list[dict]) -> dict[str, float]:
    total = sum(h["value"] for h in priced_holdings)
    if not total:
        return {}

    totals: dict[str, float] = {}
    for h in priced_holdings:
        sector = h.get("sector") or BUCKET_OTHER
        if sector.lower() == "none":
            sector = BUCKET_OTHER
        totals[sector] = totals.get(sector, 0.0) + h["value"]

    return {sector: value / total for sector, value in totals.items()}


def _top_holding(priced_holdings: list[dict]) -> dict:
    return max(priced_holdings, key=lambda h: h["value"])


def _health_label(score: float) -> str:
    if score >= 8.5:
        return "Excellent"
    if score >= 7:
        return "Healthy"
    if score >= 5:
        return "Mixed"
    return "Needs attention"


def _sector_concentration_subscore(
    priced_holdings: list[dict], sector_weights: dict[str, float], config: HealthConfig
) -> dict:
    hhi = _hhi(list(sector_weights.values()))
    score = _clamp10(
        10 * (HHI_FULLY_CONCENTRATED - hhi) / (HHI_FULLY_CONCENTRATED - config.hhi_well_spread)
    )

    top_sector, top_weight = max(sector_weights.items(), key=lambda kv: kv[1])
    sector_count = len(sector_weights)
    detail = (
        f"{top_sector} is {top_weight * 100:.0f}% of your book "
        f"(Herfindahl index {hhi:.2f} across {sector_count} sector{'s' if sector_count != 1 else ''})."
    )
    if any(not h["priced_live"] for h in priced_holdings):
        detail += " Weights include holdings priced at cost, so they're partially stale."

    improvement = (
        "Sector spread is already reasonable."
        if score >= 7
        else f"Adding exposure outside {top_sector} would bring this HHI down and spread the risk."
    )
    
    equivalent_sectors = round(1 / config.hhi_well_spread)
    return {
        "key": "sectorConcentration",
        "label": "Sector Concentration",
        "weight": config.weight_sector_concentration,
        "value": _round1(score),
        "detail": detail,
        "target": (
            f"HHI at or below {config.hhi_well_spread:.2f} "
            f"(roughly {equivalent_sectors}+ evenly-weighted sectors)"
        ),
        "improvement": improvement,
    }


def _single_position_subscore(
    priced_holdings: list[dict], total_value: float, config: HealthConfig
) -> dict:
    top = _top_holding(priced_holdings)
    top_pct = (top["value"] / total_value * 100) if total_value else 0.0
    score = _clamp10(10 - top_pct / 10)
    ticker = top.get("ticker") or "Your largest holding"

    if top.get("kind") == KIND_ETF:
        label = "Fund Concentration"
        exposure = top.get("sector") or top.get("region") or "one market"
        fix, dominates = "funds covering other markets", "no single market carries your portfolio"
        detail = (
            f"{ticker} is {top_pct:.0f}% of your book. It's a fund, not a single company, so this "
            f"tracks {exposure} rather than one earnings result - fund look-through to underlying "
            "holdings is not applied here."
        )
    else:
        label = "Single-Stock Risk"
        fix, dominates = "other positions", "no single stock dominates your return"
        detail = f"{ticker} is {top_pct:.0f}% of your book."

    if top_pct >= config.concentration_high:
        risk_word = "High"
    elif top_pct >= config.concentration_low:
        risk_word = "Moderate"
    else:
        risk_word = "Low"
    detail += f" {risk_word} concentration."

    improvement = (
        "No single position is carrying outsized risk."
        if top_pct < config.concentration_low
        else f"Trim {ticker} or build up {fix} so {dominates}."
    )

    return {
        "key": "singleStockRisk",
        "label": label,
        "weight": config.weight_single_position,
        "value": _round1(score),
        "detail": detail,
        "target": f"Under {config.concentration_low:g}% in any one holding",
        "improvement": improvement,
    }


def _breadth_subscore(
    priced_holdings: list[dict], total_value: float, config: HealthConfig
) -> dict:
    holding_weights = [h["value"] / total_value for h in priced_holdings] if total_value else []
    hhi = _hhi(holding_weights)
    effective_n = (1 / hhi) if hhi > 0 else 0.0
    score = _clamp10(effective_n / config.breadth_target_n * 10)

    count = len(priced_holdings)
    detail = (
        f"{count} position{'s' if count != 1 else ''} in your book, but weighted by size that's only "
        f"{effective_n:.1f} effective position{'s' if round(effective_n, 1) != 1.0 else ''} - a raw "
        "count hides how much one holding can dominate."
    )
    improvement = (
        "Effective breadth is already in a healthy range."
        if effective_n >= config.breadth_target_n
        else "Adding positions - or trimming the ones that dominate - raises effective breadth toward the target."
    )

    return {
        "key": "portfolioBreadth",
        "label": "Portfolio Breadth",
        "weight": config.weight_breadth,
        "value": _round1(score),
        "detail": detail,
        "target": f"{config.breadth_target_n:g}+ effective positions",
        "improvement": improvement,
    }


def compute_health_score(priced_holdings: list[dict], config: HealthConfig | None = None) -> dict:
    if not priced_holdings:
        return {"score": None, "label": None, "subscores": []}

    config = config or DEFAULT_CONFIG
    total_value = sum(h["value"] for h in priced_holdings)
    sector_weights = _sector_weights(priced_holdings)

    subscores = [
        _sector_concentration_subscore(priced_holdings, sector_weights, config),
        _single_position_subscore(priced_holdings, total_value, config),
        _breadth_subscore(priced_holdings, total_value, config),
    ]

    score = sum(s["weight"] * s["value"] for s in subscores)
    return {"score": _round1(score), "label": _health_label(score), "subscores": subscores}


__all__ = [
    "CONCENTRATION_HIGH",
    "CONCENTRATION_LOW",
    "CONFIG_FIELDS",
    "DEFAULT_CONFIG",
    "PRESETS",
    "PRESET_EQUITYLENS",
    "HealthConfig",
    "HealthPreset",
    "compute_health_score",
    "config_from_dict",
    "config_to_dict",
    "matching_preset_key",
    "preset_config",
    "presets_payload",
]
