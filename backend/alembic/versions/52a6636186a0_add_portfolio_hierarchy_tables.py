"""add portfolio hierarchy tables

Revision ID: 52a6636186a0
Revises: b2c3d4e5f6a7
Create Date: 2026-06-30 12:13:44.640074

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "52a6636186a0"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "instrument_types",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("instrument_name", sa.String(length=100), nullable=False),
        sa.Column("instrument_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instrument_name", name="uq_instrument_types_name"),
    )

    op.create_table(
        "narrative_types",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("narrative_name", sa.String(length=100), nullable=False),
        sa.Column("narrative_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("narrative_name", name="uq_narrative_types_name"),
    )

    op.create_table(
        "transaction_types",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("transaction_name", sa.String(length=100), nullable=False),
        sa.Column("transaction_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transaction_name", name="uq_transaction_types_name"),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("file_name", sa.String(length=100), nullable=False),
        sa.Column("encrypted_file_path", sa.Text(), nullable=False),
        sa.Column("encrypted_document_text", sa.Text(), nullable=True),
        sa.Column("extracted_password", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "portfolios",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("account_number", sa.String(length=100), nullable=False),
        sa.Column("portfolio_name", sa.String(length=100), nullable=False),
        sa.Column("statement_end_date", sa.Date(), nullable=True),
        sa.Column("statement_start_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "holdings",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("instrument_name", sa.String(length=100), nullable=False),
        sa.Column("ticker", sa.String(length=100), nullable=True),
        sa.Column("sector", sa.String(length=100), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("total_cost", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("cost_price", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("current_price", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("current_value", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("weight_percentage", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "instrument_purchases_and_sales",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("transactions_date", sa.Date(), nullable=True),
        sa.Column("transaction_type_id", sa.UUID(), nullable=False),
        sa.Column("instrument_type_id", sa.UUID(), nullable=False),
        sa.Column("price", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("transactions_cost", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("value_zar", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instrument_type_id"], ["instrument_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_type_id"], ["transaction_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "transaction_costs",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("instrument_type_id", sa.UUID(), nullable=False),
        sa.Column("brokerage", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("other_trading_costs", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instrument_type_id"], ["instrument_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "contributions_and_withdrawals",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=True),
        sa.Column("settlement_date", sa.Date(), nullable=True),
        sa.Column("transaction_type_id", sa.UUID(), nullable=False),
        sa.Column("value_zar", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_type_id"], ["transaction_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "dividends_and_withholding_tax",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=True),
        sa.Column("instrument_type_id", sa.UUID(), nullable=False),
        sa.Column("gross_dividend", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("withholding_tax", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("net_dividend", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("tax_rate", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instrument_type_id"], ["instrument_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "transaction_interest",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=True),
        sa.Column("settlement_date", sa.Date(), nullable=True),
        sa.Column("transaction_type_id", sa.UUID(), nullable=False),
        sa.Column("instrument_type_id", sa.UUID(), nullable=False),
        sa.Column("value_zar", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["instrument_type_id"], ["instrument_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_type_id"], ["transaction_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "transaction_expenses",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("portfolio_id", sa.UUID(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=True),
        sa.Column("settlement_date", sa.Date(), nullable=True),
        sa.Column("transaction_type_id", sa.UUID(), nullable=False),
        sa.Column("narrative_type_id", sa.UUID(), nullable=False),
        sa.Column("value_zar", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["narrative_type_id"], ["narrative_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_type_id"], ["transaction_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # explicit indexes for query performance
    op.create_index("ix_documents_user_id", "documents", ["user_id"])
    op.create_index("ix_portfolios_user_id", "portfolios", ["user_id"])
    op.create_index("ix_portfolios_document_id", "portfolios", ["document_id"])
    op.create_index("ix_holdings_portfolio_id", "holdings", ["portfolio_id"])
    op.create_index("ix_holdings_ticker", "holdings", ["ticker"])
    op.create_index("ix_instrument_purchases_and_sales_portfolio_id", "instrument_purchases_and_sales", ["portfolio_id"])
    op.create_index("ix_transaction_costs_portfolio_id", "transaction_costs", ["portfolio_id"])
    op.create_index("ix_contributions_and_withdrawals_portfolio_id", "contributions_and_withdrawals", ["portfolio_id"])
    op.create_index("ix_dividends_and_withholding_tax_portfolio_id", "dividends_and_withholding_tax", ["portfolio_id"])
    op.create_index("ix_transaction_interest_portfolio_id", "transaction_interest", ["portfolio_id"])
    op.create_index("ix_transaction_expenses_portfolio_id", "transaction_expenses", ["portfolio_id"])

    # seed lookup tables, abdul's services depend on these rows existing
    op.execute("""
        INSERT INTO narrative_types(narrative_name, narrative_description) VALUES
        ('Cash Management Fee', ''),
        ('VAT on Cash Management Fee', ''),
        ('Early Settlement Fee', ''),
        ('Value Added Tax on costs (VAT) for Early Settlement Fee', '')
    """)
    op.execute("""
        INSERT INTO instrument_types(instrument_name, instrument_description) VALUES
        ('10X S&P South Africa Top50 Index Exchange Traded Fund', ''),
        ('10X S&P 500 Exchange Traded Fund', ''),
        ('EasyETFs AI World Actively Managed ETF', ''),
        ('Satrix MSCI Emerging Markets ETF', ''),
        ('Trust Account', '')
    """)
    op.execute("""
        INSERT INTO transaction_types(transaction_name, transaction_description) VALUES
        ('Cash Management Fee', ''),
        ('VAT on Cash Management Fee', ''),
        ('Early settlement fee', ''),
        ('VAT', ''),
        ('Cash investment interest received', ''),
        ('Securities Interest', ''),
        ('Capital contribution', ''),
        ('Capital withdrawal', ''),
        ('Sales', ''),
        ('Purchases', '')
    """)


def downgrade() -> None:
    op.drop_index("ix_transaction_expenses_portfolio_id", table_name="transaction_expenses")
    op.drop_index("ix_transaction_interest_portfolio_id", table_name="transaction_interest")
    op.drop_index("ix_dividends_and_withholding_tax_portfolio_id", table_name="dividends_and_withholding_tax")
    op.drop_index("ix_contributions_and_withdrawals_portfolio_id", table_name="contributions_and_withdrawals")
    op.drop_index("ix_transaction_costs_portfolio_id", table_name="transaction_costs")
    op.drop_index("ix_instrument_purchases_and_sales_portfolio_id", table_name="instrument_purchases_and_sales")
    op.drop_index("ix_holdings_ticker", table_name="holdings")
    op.drop_index("ix_holdings_portfolio_id", table_name="holdings")
    op.drop_index("ix_portfolios_document_id", table_name="portfolios")
    op.drop_index("ix_portfolios_user_id", table_name="portfolios")
    op.drop_index("ix_documents_user_id", table_name="documents")

    op.drop_table("transaction_expenses")
    op.drop_table("transaction_interest")
    op.drop_table("dividends_and_withholding_tax")
    op.drop_table("contributions_and_withdrawals")
    op.drop_table("transaction_costs")
    op.drop_table("instrument_purchases_and_sales")
    op.drop_table("holdings")
    op.drop_table("portfolios")
    op.drop_table("documents")
    op.drop_table("transaction_types")
    op.drop_table("narrative_types")
    op.drop_table("instrument_types")