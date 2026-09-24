from uuid import UUID

from sqlalchemy.orm import Session

from app.models.portfolio import Portfolios
from app.models.portfolio import Holdings

def get_user_holdings(db: Session, user_id: UUID) -> list[str]:
    tickers = (
        db.query(Holdings.ticker)
        .join(Portfolios, Holdings.portfolio_id == Portfolios.id)
        .filter(
            Portfolios.user_id == user_id,
            Holdings.ticker.isnot(None),
            Holdings.ticker != "",
            Holdings.ticker != "None",
            Holdings.ticker != "none",
        )
        .distinct()
        .all()
    )
    normalized = {t[0].upper().removesuffix(".JO") for t in tickers}
    return sorted(normalized)