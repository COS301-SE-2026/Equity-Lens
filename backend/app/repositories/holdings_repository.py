from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.portfolio import Holdings


class HoldingsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_portfolio_ids(self, portfolio_ids: list[UUID]) -> list[Holdings]:
        if not portfolio_ids:
            return []

        stmt = (
            select(Holdings)
            .where(Holdings.portfolio_id.in_(portfolio_ids))
            .order_by(Holdings.total_cost.desc()))
        return list(self.db.scalars(stmt).all())