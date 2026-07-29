from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.portfolio import DividendsAndWithholdingTax


class TransactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_dividends(self, portfolio_ids: list[UUID]) -> list[DividendsAndWithholdingTax]:
        if not portfolio_ids:
            return []

        stmt = (
            select(DividendsAndWithholdingTax)
            .where(DividendsAndWithholdingTax.portfolio_id.in_(portfolio_ids))
            .order_by(DividendsAndWithholdingTax.transaction_date.asc())
        )
        return list(self.db.scalars(stmt).all())