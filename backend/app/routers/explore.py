from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.schemas.auth import UserResponse
from app.services import (
        exposure_engine,
        index_universe,
        portfolio_tickers,
        recommendation_copy,
        universe_features,
)

router = APIRouter(prefix="/api/explore", tags=["explore"])
 
 
@router.get("/recommendations")
def get_recommendations(
    k: int = Query(9, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> dict:
        portfolio = portfolio_tickers.get_user_holdings(db, user_id=current_user.id)
        if not portfolio:
            return {"eligible": False, "reason": "no_holdings", "excluded": []}

        excluded = [t for t in portfolio if not universe_features.is_jse_equity(t)]
        portfolio = [t for t in portfolio if t not in excluded]
        if not portfolio:
            return {"eligible": False, "reason": "no_jse_holdings", "excluded": excluded}
        try:
            seed_symbols = index_universe.market_universe("JSE", db)
        except index_universe.UniverseUnavailableError as error:
            raise HTTPException(
                status_code=503, 
                detail="Market data temporarily unavailable") from error
        seed = {s.upper().removesuffix(".JO") for s in seed_symbols}
        universe_tickers = sorted(set(seed_symbols) | {t for t in portfolio 
            if t.upper() not in seed})
        universe = universe_features.build_universe_features(universe_tickers)
        raw_by_ticker = {f.ticker: f for f in universe}
        reference = [f for f in universe if f.ticker in seed]
        normalized = exposure_engine.normalize_universe(universe, reference=reference)
        norm_by_ticker = {f.ticker: f for f in normalized}
    
        recs_by_holding = {
            t: exposure_engine.similarity_scores(
                norm_by_ticker[t], 
                normalized, 
                k=k + len(portfolio))
            for t in portfolio
            if t in norm_by_ticker
        }
        recommended = _merge_top_k(recs_by_holding, k=k, exclude=set(portfolio))
        for rec in recommended:
            source_sector = raw_by_ticker[rec["similar_to"]].sector
            target_sector = raw_by_ticker[rec["ticker"]].sector
            rec["description"] = recommendation_copy.describe_similar(
                rec, 
                source_sector, 
                target_sector)
    
        return {
            "eligible": True,
            "portfolio": [
                _to_point(
                    raw_by_ticker[t], 
                    highlighted=True) for t in portfolio if t in raw_by_ticker
            ],
            "universe": [_to_point(f) for f in universe],
            "recommended": recommended,
            "excluded": excluded,
        }
 
 
def _merge_top_k(recs_by_holding: dict[str, list[dict]], k: int, exclude: set[str]) -> list[dict]:
    queues = {
        src: sorted(
            (r for r in recs if r["ticker"] not in exclude),
            key=lambda r: r["distance"],
        )
        for src, recs in recs_by_holding.items()
    }
    queues = {src: q for src, q in queues.items() if q}
    turn_order = sorted(queues, key=lambda s: queues[s][0]["distance"])
    chosen: dict[str, dict] = {}
    while turn_order and len(chosen) < k:
        for src in list(turn_order):
            q = queues[src]
            while q and q[0]["ticker"] in chosen:
                q.pop(0)
            if not q:
                turn_order.remove(src)
                continue
            rec = q.pop(0)
            chosen[rec["ticker"]] = {**rec, "similar_to": src}
            if len(chosen) >= k:
                break
    return sorted(chosen.values(), key=lambda r: r["distance"])
 
 
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