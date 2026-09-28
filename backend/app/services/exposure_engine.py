import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Feature:
    ticker: str
    name: str               
    sector: str
    market_cap: float        
    local_float_pct: float   
    dividend_yield: float    
 
 
@dataclass(frozen=True)
class NormalizedFeature:
    ticker: str
    sector: str
    z_log_mcap: float
    z_local_float: float
    z_div_yield: float
 
# Derived from real data, not guessed: across the 120-stock JSE screener
# universe, same-sector pairs had median distance 1.925 and different-sector
# pairs had p25 distance 1.500 (1,001 same-sector pairs, 6,139
# different-sector pairs). For a typical same-sector match to still beat a
# strong cross-sector match, the penalty must exceed 1.925 - 1.500 = 0.425.
# Set with small headroom above that, deliberately not much higher, so
# genuine cross-sector matches still surface instead of being hard-filtered
# away. The earlier 0.4 was derived the same way on a 30-stock seed list and
# fell just below this threshold once the universe grew. Re-run the
# measurement and re-derive this if the universe changes substantially.
SECTOR_MISMATCH_PENALTY = 0.45
YIELD_CAP = 15.0
# Expected distance between 2 random stocks
RANDOM_PAIR_DISTANCE = 2.26
 
def normalize_universe(features: list[Feature], reference: list[Feature] | None = None):
    ref = reference or features

    def columns(fs: list[Feature]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        return (
            np.array([math.log10(f.market_cap) for f in fs]),
            np.array([f.local_float_pct for f in fs]),
            np.array([min(f.dividend_yield, YIELD_CAP) for f in fs]),
        )

    def z(arr: np.ndarray, ref_arr: np.ndarray) -> np.ndarray:
        std = ref_arr.std()
        return (arr - ref_arr.mean()) / std if std > 0 else np.zeros_like(arr)

    z_mcap, z_float, z_div = (z(c, r) for c, r in zip(
        columns(features), 
        columns(ref), 
        strict=False))

 
    return [
        NormalizedFeature(f.ticker, f.sector, float(z_mcap[i]), float(z_float[i]), float(z_div[i]))
        for i, f in enumerate(features)
    ]
 
 
def _distance(a: NormalizedFeature, b: NormalizedFeature) -> float:
    euclidean = math.sqrt(
        (a.z_log_mcap - b.z_log_mcap) ** 2
        + (a.z_local_float - b.z_local_float) ** 2
        + (a.z_div_yield - b.z_div_yield) ** 2
    )
    if a.sector != b.sector:
        euclidean += SECTOR_MISMATCH_PENALTY
    return euclidean

def _gaps(a: NormalizedFeature, b: NormalizedFeature) -> dict[str, float]:
    return {
        "size": round(abs(a.z_log_mcap - b.z_log_mcap), 3),
        "free float": round(abs(a.z_local_float - b.z_local_float), 3),
        "dividend yield": round(abs(a.z_div_yield - b.z_div_yield), 3),
    }
 
def similarity_scores(
    holding: NormalizedFeature,
    universe: list[NormalizedFeature],
    k: int = 6,
) -> list[dict]:
    candidates = [f for f in universe if f.ticker != holding.ticker]
    scored = [(f, _distance(holding, f)) for f in candidates]
    scored.sort(key=lambda pair: pair[1])
 
    return [
        {
            "ticker": f.ticker,
            "similar_to": holding.ticker,
            "distance": round(d, 3),
            "closeness": round(max(0.0, 1 - d / RANDOM_PAIR_DISTANCE), 3),
            "gaps": _gaps(holding, f),
        }
        for f, d in scored[:k]
    ]