import io
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Image, Paragraph,SimpleDocTemplate,Spacer,Table,TableStyle,)

def _chart_buffer():
    return io.BytesIO()

def create_allocation_chart(allocation: list):
    labels = [item.get("name", "Unknown") for item in allocation]
    values = [float(item.get("weight_percentage",0)) for item in allocation]

    buffer = _chart_buffer()

    fig, ax = plt.subplots(figsize=(6, 3.5))

    ax.pie(values,labels=labels,autopct="%1.1f%%",startangle=90,)

    ax.set_title("Portfolio Allocation")

    plt.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    plt.close(fig)

    buffer.seek(0)

    return buffer

def create_trading_chart(trading: list):
    labels = [item.get("name", "Unknown") for item in trading]
    values = [float(item.get("value",0) for item in trading)]

    buffer = _chart_buffer()

    fig, ax = plt.subplots(figsize=(6, 3.5))

    ax.bar(labels, values)

    ax.set_title("Trading Activity")
    ax.set_ylabel("Value(ZAR)")
    plt.xticks(rotation=30, ha="right")

    plt.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    plt.close(fig)

    buffer.seek(0)

    return buffer

def create_dividend_chart(dividends: list):
    labels = [item.get("name", "Unknown") for item in dividends]
    gross = [float(item.get("gross_dividend",0)) for item in dividends]
    net = [float(item.get("net_dividend",0)) for item in dividends]

    buffer = _chart_buffer()

    fig, ax = plt.subplots(figsize=(6, 3.5))

    ax.plot(labels, gross, marker="o", label="Gross Dividend")
    ax.plot(labels, net, marker="o", label="Net Dividend")

    ax.set_title("Dividend Income")
    ax.set_ylabel("Value(ZAR)")
    ax.legend()

    plt.xticks(rotation=30, ha="right")

    plt.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    plt.close(fig)

    buffer.seek(0)

    return buffer

def generate_portfolio_brief(portfolio_id: str, snapshot_hash: str, snapshot: dict)
    output = io.BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title="Equity Lens Portfolio Summary",
    )

    styles = getSampleStyleSheet()

    story = []

    summary = snapshot.get("summary", {})
    holdings = snapshot.get("holdings", {})
    activity = snapshot.get("activity", {})

    story.append(Paragraph("Equity Lens - Smart Portfolio Snapshot", styles["Title"]))
    story.append(Spacer(1,8))
    story.append(Paragraph(f"Portfolio: {portfolio_id}", styles["BodyText"]))
    story.append(Spacer(1,4))
    story.append(Paragraph(f"Verified SHA-256 Snapshot: {snapshot_hash}", styles["BodyText"]))
    story.append(Spacer(1,18))

    story.append(Paragraph("Portfolio Summary", styles["Heading2"],))

    summary_data = [
        ["Portfolio Value", f"R {float(summary.get('PortfolioValue', 0)):,.2f}",],
        ["Total Holdings", f"R {float(summary.get('TotalHoldings', 0)):,.2f}",],
        ["Purchase & Sales", f"R {float(summary.get('TotalPurchaseAndSales', 0)):,.2f}",],
        ["Contributions & withdrawals", f"R {float(summary.get('TotalContributionsAndWithdrawals', 0)):,.2f}",],
        ["Dividends", f"R {float(summary.get('TotalDividendsAndWithholdingTax', 0)):,.2f}",],
        ["Expenses", f"R {float(summary.get('TotalTransactionExpenses', 0)):,.2f}",],
    ]

