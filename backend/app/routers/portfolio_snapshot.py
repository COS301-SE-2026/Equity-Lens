from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.portfolio import Holdings
from app.repositories.portfolio_repository import PortfolioRepository
from app.routers.news import fetch_market_news, fetch_ticker_news
from app.schemas.auth import UserResponse
from app.services.pdf_summary_service import (
    get_cash_flow_import_PDF,
    get_dividend_income_import_PDF,
    get_summary_import_PDF,
    get_the_lowest_holdings_import_PDF,
    get_the_top_allocation_import_PDF,
    get_the_top_holdings_import_PDF,
    get_trading_activity_import_PDF,
)
from app.services.portfolio_analytics_service import (
    get_portfolio_analytics,
)
from app.services.portfolio_brief_service import generate_portfolio_brief
from app.services.portfolio_snapshot_service import build_snapshot

router = APIRouter(prefix="/api/portfolio_snapshot", tags=["Portfolio Snapshot"])

@router.get("/{portfolio_id}")
def get_portfolio_snapshot(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)):
    repository = PortfolioRepository(db)

    portfolio = repository.get_portfolio_for_user(
        portfolio_id=portfolio_id, 
        user_id=current_user.id,
    )

    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail="Portfolio Not Found"
        )

    summary = get_summary_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    top_holdings = get_the_top_holdings_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    allocation = get_the_top_allocation_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )


    lowest = get_the_lowest_holdings_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )


    trading = get_trading_activity_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    cash_flow = get_cash_flow_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    dividends = get_dividend_income_import_PDF(
        database=db,
        portfolioID=str(portfolio_id),
        user_id=current_user.id,
    )

    analytics = get_portfolio_analytics(db=db, portfolio_id=portfolio_id,)


    tickers = (
        db.query(Holdings.ticker)
        .filter(
            Holdings.portfolio_id == portfolio_id,
            Holdings.ticker.isnot(None),
            Holdings.ticker != "",
            Holdings.ticker != "None",
            Holdings.ticker != "none",
        ).distinct().all()
    )

    ticker_list = [ticker[0] for ticker in tickers]

    portfolio_news = []

    for ticker in ticker_list:
        try:
            data = fetch_ticker_news(ticker)

            articles = data.get("data", [])

            for article in articles[:5]:
                portfolio_news.append(
                    {
                        "ticker": ticker,
                        "title": article.get("title"),
                        "description": article.get("description"),
                        "source": article.get("source"),
                        "published_at": article.get("published_at"),
                        "image_url": article.get("image_url"),
                        "url": article.get("url"),
                    }
                )

        except Exception:
            return None

    market_news = []

    try:
        market_data = fetch_market_news("business")

        for article in market_data.get("results", [])[:5]:
            market_news.append(
                {
                    "title": article.get("title"),
                    "description": article.get("description"),
                    "source": article.get("source_name"),
                    "published_at": article.get("pubDate"),
                    "image_url": article.get("image_url"),
                    "url": article.get("link"),
                }
            )

    except Exception:
        return None

    snapshot = build_snapshot(
        portfolio_id=str(portfolio_id),
        summary=summary,
        top_holdings=top_holdings,
        allocation=allocation,
        lowest_holding=lowest,
        trading_activity=trading,
        cash_flow=cash_flow,
        dividend_income=dividends,
        portfolio_news=portfolio_news,
        market_news=market_news,
        analytics=analytics,
    )

    stored_snapshot = repository.save_canonical_snapshot(
        portfolio_id=portfolio_id,
        snapshot_hash=snapshot["snapshot_id"],
        snapshot_data=snapshot["snapshot"],

    )

    return {
        "snapshot_id": snapshot["snapshot_id"],
        "snapshot": snapshot["snapshot"],
        "stored_snapshot_id": str(stored_snapshot.id),
        "created_at": stored_snapshot.created_at,
    }

@router.get("/{portfolio_id}/download")
def download_portfolio_snapshot(
    portfolio_id: UUID,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)):
    repository = PortfolioRepository(db)
    portfolio = repository.get_portfolio_for_user(
        portfolio_id=portfolio_id, 
        user_id=current_user.id,
    )

    if portfolio is None:
        raise HTTPException(
            status_code=404,
            detail="Portfolio Not Found"
        )

    stored_snapshot = (
        repository.get_latest_canonical_snapshot(portfolio_id)
    )

    if stored_snapshot is None:
        raise HTTPException(
            status_code=404,
            detail="No snapshot found for this portfolio"
        )

    pdf = generate_portfolio_brief(
        portfolio_id=str(portfolio_id),
        snapshot_hash=stored_snapshot.snapshot_hash,
        snapshot=stored_snapshot.snapshot_data,
    )

    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="Equity-lens-{current_user.full_name}.pdf"'
            )
        },
    )


