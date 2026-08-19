from datetime import date
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.portfolio import PortfolioSnapshot, Portfolios


class PortfolioRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_portfolio_ids(self, user_id: UUID) -> list[UUID]:
        stmt = select(Portfolios.id).where(Portfolios.user_id == user_id)
        return list(self.db.scalars(stmt).all())

    def get_latest_portfolio_id(self, user_id: UUID) -> UUID | None:
        stmt = (
            select(Portfolios.id)
            .where(Portfolios.user_id == user_id)
            .order_by(Portfolios.created_at.desc())
        )
        return self.db.scalars(stmt).first()

    def get_latest_portfolio(self, user_id: UUID) -> Portfolios | None:
        stmt = (
            select(Portfolios)
            .where(Portfolios.user_id == user_id)
            .order_by(Portfolios.created_at.desc())
        )
        return self.db.scalars(stmt).first()

    def upsert_snapshot(
        self,
        portfolio_id: UUID,
        snapshot_date: date,
        total_value: float,
        benchmark_value: float | None,
    ) -> None:
        stmt = select(PortfolioSnapshot).where(
            PortfolioSnapshot.portfolio_id == portfolio_id,
            PortfolioSnapshot.snapshot_date == snapshot_date,
        )
        existing = self.db.scalars(stmt).first()

        if existing:
            existing.total_value = total_value
            if benchmark_value is not None:
                existing.benchmark_value = benchmark_value
        else:
            existing = PortfolioSnapshot(
                portfolio_id=portfolio_id,
                snapshot_date=snapshot_date,
                total_value=total_value,
                benchmark_value=benchmark_value,
            )
            self.db.add(existing)

    def get_snapshot_history(self, portfolio_ids: list[UUID]) -> list[dict]:
        if not portfolio_ids:
            return []

        stmt = (
            select(
                PortfolioSnapshot.snapshot_date,
                func.round(func.sum(PortfolioSnapshot.total_value), 2).label("total_value"),
                func.round(func.avg(PortfolioSnapshot.benchmark_value), 2).label("benchmark_value"),
            )
            .where(PortfolioSnapshot.portfolio_id.in_(portfolio_ids))
            .group_by(PortfolioSnapshot.snapshot_date)
            .order_by(PortfolioSnapshot.snapshot_date.asc())
        )

        rows = self.db.execute(stmt).all()

        return [
            {
                "snapshot_date": row.snapshot_date,
                "total_value": float(row.total_value or 0.0),
                "benchmark_value": float(row.benchmark_value) if row.benchmark_value is not None else None,
            }
            for row in rows
        ]

    def get_latest_portfolio(self, user_id: UUID):
        stmt = (
            select(Portfolios)
            .where(Portfolios.user_id == user_id)
            .order_by(Portfolios.created_at.desc())
        )
        return self.db.scalers(stmt).first()

    def get_current_portfolios(self, user_id: UUID):
        stmt = (
            select(Portfolios)
            .where(Portfolios.user_id == user_id)
            .order_by(Portfolios.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())
    

    