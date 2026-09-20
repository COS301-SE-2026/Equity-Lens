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
    values = [item.get("value",0) for item in trading]

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

def generate_portfolio_brief(portfolio_id: str, snapshot_hash: str, snapshot: dict):
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
        ["Total Holdings", str(summary.get('TotalHoldings', 0))],
        ["Purchase & Sales", f"R {float(summary.get('TotalPurchasesAndSales', 0)):,.2f}",],
        ["Contributions & withdrawals", f"R {float(summary.get('TotalContributionsAndWithdrawals', 0)):,.2f}",],
        ["Dividends", f"R {float(summary.get('TotalDividendsAndWithholdingTax', 0)):,.2f}",],
        ["Expenses", f"R {float(summary.get('TotalTransactionExpenses', 0)):,.2f}",],
    ]


    summary_table = Table(summary_data, colWidths=[90 * mm, 70 * mm,],)

    summary_table.setStyle(TableStyle(
        [
            ("BACKGROUND", (0,0), (0,-1), colors.HexColor('#F3F4F6'),),
            ("FONTNAME", (0,0), (0,-1), 'Helvetica-Bold'),
            ("GRID", (0,0), (-1,-1),0.5, colors.HexColor('#D1D5DB'),),
            ("LEFTPADDING", (0,0), (-1,-1), 8,),
            ("RIGHTPADDING", (0,0), (-1,-1), 8,),
            ("TOPPADDING", (0,0), (-1,-1), 7,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7,),
        ]
        ))

    story.append(summary_table)
    story.append(Spacer(1,20))

    allocation = holdings.get(
        "allocation", [],
    )

    if allocation:
        story.append(Paragraph("Portfolio Allocation", styles["Heading2"],))
        allocation_chart = (create_allocation_chart(allocation))
        story.append(Image(allocation_chart, width=160 * mm, height=90 * mm,))
        story.append(Spacer(1,15))



    top_holdings = holdings.get("top", [],)
    if top_holdings:
        story.append(Paragraph("Top Holdings", styles["Heading2"],))
        holdings_data = [["Holding", "Value"]]
        for holding in top_holdings:
            holdings_data.append([holding.get("name", "Unknown"), ("R " f"{float(holding.get('value',0)):,.2f}")])

        holdings_table = Table(
            holdings_data,
            colWidths=[
                100 * mm,
                60 * mm,
            ],
            repeatRows=1,
        )

        holdings_table.setStyle(TableStyle(
        [
            ("BACKGROUND", (0,0), (0,-1), colors.HexColor('#F3F4F6'),),
            ("FONTNAME", (0,0), (0,-1), 'Helvetica-Bold'),
            ("GRID", (0,0), (-1,-1),0.5, colors.HexColor('#D1D5DB'),),
            ("TOPPADDING", (0,0), (-1,-1), 7,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7,),
        ]
        ))

        story.append(holdings_table)
        story.append(Spacer(1,20))

    trading = activity.get("trading", [],)









