from datetime import date
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session
from app.models.portfolio import (
    ContributionsAndWithdrawals,
    DividendsAndWithholdingTax,
    InstrumentPurchasesAndSales,
    PortfolioSnapshot,
    Portfolios,
    TransactionExpenses,
)
from app.schemas.portfolio import ACCOUNT_TYPE_CURRENCY
class PortfolioRepository:
    def __init__(self, db: Session):
        self.db = db

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

    def get_current_portfolios(self, user_id: UUID, account_type: str | None = None) -> list[Portfolios]:
        latest = self.get_latest_portfolio(user_id)
        if latest is None:
            return []
        if account_type is not None and latest.account_type != account_type:
            return []
        return [latest]

    def set_account_type(self, portfolio_id: UUID, account_type: str | None) -> Portfolios | None:
        portfolio = self.db.get(Portfolios, portfolio_id)
        if portfolio is None:
            return None
        portfolio.account_type = account_type
        if account_type is not None:
            portfolio.currency = ACCOUNT_TYPE_CURRENCY[account_type]
        return portfolio

    def upsert_snapshot(
        self,
        portfolio_id: UUID,
        snapshot_date: date,
        total_value: float,
        benchmark_value: float | None,
    ) -> None:
        insert = sqlite_insert if self.db.get_bind().dialect.name == "sqlite" else postgres_insert
        stmt = insert(PortfolioSnapshot).values(
            portfolio_id=portfolio_id,
            snapshot_date=snapshot_date,
            total_value=total_value,
            benchmark_value=benchmark_value,
        )
        self.db.execute(
            stmt.on_conflict_do_update(
                index_elements=["portfolio_id", "snapshot_date"],
                set_={
                    "total_value": stmt.excluded.total_value,
                    "benchmark_value": func.coalesce(
                        stmt.excluded.benchmark_value, PortfolioSnapshot.benchmark_value
                    ),
                },
            )
        )

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

    def get_instrument_transactions(self, portfolio_ids: list[UUID]) -> list[InstrumentPurchasesAndSales]:
        if not portfolio_ids:
            return []
        stmt = (
            select(InstrumentPurchasesAndSales)
            .where(InstrumentPurchasesAndSales.portfolio_id.in_(portfolio_ids))
            .order_by(InstrumentPurchasesAndSales.transaction_date.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_contributions_and_withdrawals(self, portfolio_ids: list[UUID]) -> list[ContributionsAndWithdrawals]:
        if not portfolio_ids:
            return []
        stmt = (
            select(ContributionsAndWithdrawals)
            .where(ContributionsAndWithdrawals.portfolio_id.in_(portfolio_ids))
            .order_by(ContributionsAndWithdrawals.transaction_date.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_dividends(self, portfolio_ids: list[UUID]) -> list[DividendsAndWithholdingTax]:
        if not portfolio_ids:
            return []
        stmt = (
            select(DividendsAndWithholdingTax)
            .where(DividendsAndWithholdingTax.portfolio_id.in_(portfolio_ids))
            .order_by(DividendsAndWithholdingTax.transaction_date.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_transaction_expenses(self, portfolio_ids: list[UUID]) -> list[TransactionExpenses]:
        if not portfolio_ids:
            return []
        stmt = (
            select(TransactionExpenses)
            .where(TransactionExpenses.portfolio_id.in_(portfolio_ids))
            .order_by(TransactionExpenses.transaction_date.asc())
        )
        return list(self.db.scalars(stmt).all())
