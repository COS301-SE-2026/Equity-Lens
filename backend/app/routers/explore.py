from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
 
from app.dependencies import get_current_user, get_db
from app.schemas.auth import UserResponse
from app.services import exposure_engine, index_universe, portfolio_tickers, recommendation_copy, universe_features
 
router = APIRouter(prefix="/api/explore", tags=["explore"])
 
 
@router.get("/recommendations")
def get_recommendations(
    k: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> dict:
    portfolio = portfolio_tickers.get_user_holdings(db, user_id=current_user.id)
    if not portfolio:
        raise HTTPException(status_code=400, detail="No holdings to base recommendations on")
 
    universe_tickers = sorted(set(index_universe.SEED_UNIVERSE) | set(portfolio))
    universe = universe_features.build_universe_features(universe_tickers)
    raw_by_ticker = {f.ticker: f for f in universe}
    seed = {t.upper().removesuffix(".JO") for t in index_universe.SEED_UNIVERSE}
    reference = [f for f in universe if f.ticker in seed]
    normalized = exposure_engine.normalize_universe(universe, reference=reference)
    norm_by_ticker = {f.ticker: f for f in normalized}
 
    recs_by_holding = {
        t: exposure_engine.similarity_scores(norm_by_ticker[t], normalized, k=k + len(portfolio))
        for t in portfolio
        if t in norm_by_ticker
    }
    recommended = _merge_top_k(recs_by_holding, k=k, exclude=set(portfolio))
    for rec in recommended:
        source_sector = raw_by_ticker[rec["similar_to"]].sector
        target_sector = raw_by_ticker[rec["ticker"]].sector
        rec["description"] = recommendation_copy.describe_similar(rec, source_sector, target_sector)
 
    return {
        "portfolio": [
            _to_point(raw_by_ticker[t], highlighted=True) for t in portfolio if t in raw_by_ticker
        ],
        "universe": [_to_point(f) for f in universe],
        "recommended": recommended,
    }
 
 
def _merge_top_k(recs_by_holding: dict[str, list[dict]], k: int, exclude: set[str]) -> list[dict]:
    best: dict[str, dict] = {}
    for source_ticker, recs in recs_by_holding.items():
        for rec in recs:
            if rec["ticker"] in exclude:
                continue
            existing = best.get(rec["ticker"])
            if existing is None or rec["distance"] < existing["distance"]:
                best[rec["ticker"]] = {**rec, "similar_to": source_ticker}
    return sorted(best.values(), key=lambda r: r["distance"])[:k]
 
 
def _to_point(f: exposure_engine.Feature, highlighted: bool = False) -> dict:
    return {
        "ticker": f.ticker,
        "name": f.name,
        "sector": f.sector,
        "market_cap": f.market_cap,
        "local_float_pct": f.local_float_pct,
        "dividend_yield": f.dividend_yield,
        "highlighted": highlighted,
    }