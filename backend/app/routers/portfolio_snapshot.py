import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.portfolio import Holdings
from app.repositories.news_repository import NewsRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.routers.news import category_news
from app.schemas.auth import UserResponse
from app.schemas.responses import AppError
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
from app.services.portfolio_insights import build_market_drivers
from app.services.portfolio_risk_service import build_risk_assessment
from app.services.portfolio_service import PortfolioService
from app.services.portfolio_snapshot_service import build_snapshot
from app.utils.ai_rate_limit import check_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portfolio_snapshot", tags=["Portfolio Snapshot"])

PDF_SLOT_TIMEOUT_SECONDS = 20
GUEST_PDF_WINDOW_SECONDS = 600
PORTFOLIO_NEWS_PER_TICKER = 5
# each build holds the whole pdf and its charts in memory, so only a couple run at once
_PDF_SLOTS = threading.BoundedSemaphore(settings.pdf_max_concurrent)
# builds run on these threads only, one per slot. glibc keeps a malloc arena per thread
# that has built a pdf, so on the 16 request threads the memory kept after a burst grew
# with every new thread
_PDF_WORKERS = ThreadPoolExecutor(
    max_workers=settings.pdf_max_concurrent, thread_name_prefix="pdf"
)


def _pdf_busy() -> AppError:
    return AppError(
        503,
        "PDF_BUSY",
        "Lots of people are downloading right now, try again in a few seconds",
        headers={"Retry-After": "5"},
    )


def _content_disposition(filename: str) -> str:
    # headers must be latin-1, so a name in another script used to give a 500. the ascii
    # fallback keeps the header valid and filename* carries the real name as utf-8
    fallback = "".join(c if " " <= c <= "~" and c != '"' else "_" for c in filename)
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}"


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
    dashboard = None
    if repository.get_latest_portfolio_id(current_user.id) == portfolio_id:
        try:
            dashboard = PortfolioService(db).get_dashboard(current_user.id)
        except Exception:
            logger.exception("dashboard section failed for portfolio %s", portfolio_id)
            db.rollback()

    risk = None
    if dashboard:
        try:
            risk = build_risk_assessment(dashboard["holdings"])
        except Exception:
            logger.exception("risk section failed for portfolio %s", portfolio_id)

    drivers = None
    if dashboard:
        try:
            drivers = build_market_drivers(dashboard["holdings"])
        except Exception:
            logger.exception("market drivers section failed for portfolio %s", portfolio_id)

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

    # these were one marketaux call per holding on every view, outside the news budget, and
    # nothing displays them - the articles already stored are enough for the snapshot
    news_repo = NewsRepository(db)
    portfolio_news = []

    for ticker in ticker_list:
        for article in news_repo.articles_for_tickers([ticker], limit=PORTFOLIO_NEWS_PER_TICKER):
            portfolio_news.append(
                {
                    "ticker": ticker,
                    "title": article.title,
                    "description": article.description,
                    "source": article.source_name,
                    "published_at": article.published_at.isoformat(),
                    "image_url": article.image_url,
                    "url": article.url,
                }
            )

    market_news = []

    try:
        market_data = category_news("business")

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
        logger.warning("market news failed", exc_info=True)

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
        dashboard=dashboard,
        risk=risk,
        drivers=drivers,
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

    if current_user.is_guest:
        allowed, retry_after = check_limit(
            f"snapshot-pdf:{current_user.id}",
            settings.guest_snapshot_pdf_limit,
            GUEST_PDF_WINDOW_SECONDS,
        )
        if not allowed:
            raise AppError(
                429,
                "GUEST_RATE_LIMITED",
                "guest sessions can download a few PDFs every 10 minutes, try again shortly",
                headers={"Retry-After": str(retry_after)},
            )

    if not _PDF_SLOTS.acquire(timeout=PDF_SLOT_TIMEOUT_SECONDS):
        raise _pdf_busy()
    try:
        pdf = _PDF_WORKERS.submit(
            generate_portfolio_brief,
            portfolio_id=str(portfolio_id),
            snapshot_hash=stored_snapshot.snapshot_hash,
            snapshot=stored_snapshot.snapshot_data,
            user_name=current_user.full_name,
            portfolio_name=portfolio.portfolio_name,
            statement_date=portfolio.statement_end_date,
            # only the last four digits ever reach the pdf
            account_last4=(portfolio.account_number or "")[-4:] or None,
        ).result()
        pdf_bytes = pdf.getvalue()
    except MemoryError:
        raise _pdf_busy() from None
    except Exception:
        logger.exception("pdf generation failed for portfolio %s", portfolio_id)
        raise AppError(
            500, "PDF_GENERATION_FAILED", "We couldn't build the PDF, try again"
        ) from None
    finally:
        # held while the pdf is built, not while it is sent, so a slow client keeps no slot
        _PDF_SLOTS.release()

    # one send with a Content-Length: a BytesIO handed to StreamingResponse goes out line by
    # line, a thread-pool hop per chunk, and the browser cannot show progress
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": _content_disposition(
                f"Equity-lens-{current_user.full_name}.pdf"
            ),
            # a private financial document, possibly on a shared machine
            "Cache-Control": "no-store",
        },
    )


