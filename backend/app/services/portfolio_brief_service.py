import io
import requests
from PIL import Image as PILImage
from xml.sax.saxutils import escape
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (Image,PageBreak,Paragraph,SimpleDocTemplate,Spacer,Table,TableStyle,)
from pathlib import Path

def add_header_footer(canvas, doc):

    canvas.saveState()

    page_width, page_height = A4


    logo_path = (Path(__file__).resolve().parent.parent
        / "assets"
        / "equity_lens_logo.png"
    )


    if logo_path.exists():
        canvas.drawImage(str(logo_path),15 * mm,page_height - 20 * mm,width=10 * mm,height=10 * mm,preserveAspectRatio=True,mask="auto",)

    canvas.setFont("Helvetica-Bold",9,)
    canvas.setFillColor(colors.HexColor('#111827'))
    canvas.drawString(28 * mm, page_height - 15 * mm, "EQUITY LENS",)

    canvas.setFont("Helvetica",8,)
    canvas.setFillColor(colors.HexColor('#64748B'))
    canvas.drawRightString(page_width - 15 * mm, page_height - 15 * mm, "Smart Portfolio Snapshot",)
    canvas.setStrokeColor(colors.HexColor('#CBD5E1'))
    canvas.line(15 * mm, page_height - 23 * mm, page_width - 15 * mm, page_height - 23 * mm,)
    canvas.setStrokeColor(colors.HexColor('#CBD5E1'))
    canvas.line(15 * mm, 15 * mm, page_width - 15 * mm, 15 * mm)


    canvas.setFont("Helvetica",7,)
    canvas.setFillColor(colors.HexColor('#64748B'))
    canvas.drawString(15 * mm, 10 * mm, "Equity Lens | Smart Portfolio Snapshot",)

    canvas.drawRightString(page_width - 15 * mm, 10 * mm, f"Page {doc.page}",)

    canvas.restoreState()

def get_indicator_value(indicator: dict):
    if not indicator:
        return "N/A"

    value = indicator.get("value")
    unit = indicator.get("unit","")

    if value is None:
        return "N/A"

    return f"{float(value):.2f}{unit}"

def safe_text(value):
    if value is None:
        return ""

    return escape(str(value))

def get_news_image(image_url):
    if not image_url:
        return None

    try:
        response = requests.get(image_url,timeout=8,headers={
            "User-Agent": (
                "Mozilla/5.0 "
                "(Window NT 10.0; Win64; x64)"
            )
        },
        )

        response.raise_for_status()

        source_buffer = io.BytesIO(response.content)

        image = PILImage.open(source_buffer)

        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")

        output_buffer = io.BytesIO()

        image.save(output_buffer, format="PNG",)

        output_buffer.seek(0)

        return output_buffer

    except Exception as error:
        print("The image could not be loaded.")

        return None

def create_news_card(article: dict, styles, show_ticker=False,):
    ticker = safe_text(article.get("ticker", ""))
    title = safe_text(article.get("title", "No Title"))
    source = safe_text(article.get("source", ""))
    description = safe_text(article.get("description", ""))

    words = description.split()
    if len(words) > 100:
        description = " ".join(words[:100]) + "..."

    published_at = safe_text(article.get("published_at", ""))
    image_url = safe_text(article.get("image_url", ""))
    article_url = safe_text(article.get("url", ""))

    if show_ticker and ticker:
        title_text = (f"{ticker} - {title}")
    else:
        title_text = title
    
    text_content = []

    text_content.append(Paragraph(f"<b>{title_text}</b>", styles["NewsTitle"],))

    allTogther = []

    if source:
        allTogther.append(source)

    if published_at:
        allTogther.append(published_at)

    if allTogther:
        text_content.append(Spacer(1,3))
        text_content.append(Paragraph("|".join(allTogther), styles["NewsMeta"],))

    if description:
        text_content.append(Spacer(1,6))
        text_content.append(Paragraph(description, styles["NewsDescription"],))

    if article_url:
        safe_url = escape(str(article_url), {'"': "&quot;",},)
        text_content.append(Spacer(1,8))
        text_content.append(Paragraph((f'<link href="{safe_url}" 'f'color="#2563EB">'f'<b>Read full article</b>'f'</link>'),styles["NewsLink"],))

    image_buffer = get_news_image(image_url)

    if image_buffer:
        article_image = Image(image_buffer, width=45 *mm, height=30 * mm)
    else:
        article_image = Paragraph("Image unaviable", styles["NewsMeta"])


    card = Table([[article_image, text_content]], colWidths=[50 * mm, 120 * mm,],)


    card.setStyle(TableStyle(
        [
            ("BACKGROUND", (0,0), (0,-1), colors.HexColor('#F8FAFC'),),
            ("BOX", (0,0), (-1,-1),0.7, '#CBD5E1'),
            ("LEFTPADDING", (0,0), (-1,-1), 8,),
            ("RIGHTPADDING", (0,0), (-1,-1), 8,),
            ("TOPPADDING", (0,0), (-1,-1), 7,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7,),
        ]
        ))

    return card


def _chart_buffer():
    return io.BytesIO()

def create_cash_flow_chart(allocation: list):
    labels = [item.get("name", "Unknown") for item in allocation]
    values = [float(item.get("value",0)) for item in allocation]

    buffer = _chart_buffer()

    fig, ax = plt.subplots(figsize=(6, 3.5))

    ax.bar(labels, values)

    ax.set_title("Cash Flow")
    ax.set_ylabel("Value(ZAR)")

    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    plt.close(fig)

    buffer.seek(0)

    return buffer

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
        topMargin=32 * mm,
        bottomMargin=22 * mm,
        title="Equity Lens Portfolio Summary",
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=colors.HexColor('#111827'), spaceAfter=8,))
    styles.add(ParagraphStyle(name="NewsTitle", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=colors.HexColor('#111827')))
    styles.add(ParagraphStyle(name="NewsMeta", parent=styles["BodyText"], fontSize=8, leading=10, textColor=colors.HexColor('#64748B'),))
    styles.add(ParagraphStyle(name="NewsDescription", parent=styles["BodyText"], fontSize=9, leading=12, textColor=colors.HexColor('#334155'),))
    styles.add(ParagraphStyle(name="NewsLink", parent=styles["BodyText"], fontSize=9, leading=11,))


    story = []

    story.append(PageBreak())

    summary = snapshot.get("summary", {})
    holdings = snapshot.get("holdings", {})
    activity = snapshot.get("activity", {})
    news = snapshot.get("news", {})
    portfolio_news = news.get("portfolio", [])
    market_news = news.get("market", [])
    analytics = snapshot.get("analytics", [])

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

    if trading:
        story.append(Paragraph("Trading Activity", styles["Heading2"],))

        dividend_chart = create_trading_chart(trading)

        story.append(Image(dividend_chart, width=160 * mm, height=90 * mm))
        story.append(Spacer(1,15))

    dividends = activity.get("dividend_income", [],)

    if dividends:
        story.append(Paragraph("Dividend Income", styles["Heading2"],))

        trading_chart = create_dividend_chart(dividends)

        story.append(Image(trading_chart, width=160 * mm, height=90 * mm))
        story.append(Spacer(1,20))

    cash_flow = activity.get("cash_flow", [],)

    if cash_flow:
        story.append(Paragraph("Cash Flow", styles["Heading2"],))

        cash_flow_chart = create_cash_flow_chart(cash_flow)

        story.append(Image(cash_flow_chart, width=160 * mm, height=90 * mm))
        story.append(Spacer(1,15))

    story.append(Spacer(1,15))

    story.append(Paragraph("My Portfolio News", styles["SectionTitle"]))
    story.append(Paragraph("This is the latest news related to holdings in this portfolio", styles["NewsMeta"]))
    story.append(Spacer(1,8,))

    if portfolio_news:
        for article in portfolio_news[:5]:
            news_card = create_news_card(article, styles, show_ticker=True,)


            story.append(news_card)
            story.append(Spacer(1,10))

    else:
        story.append(Paragraph("No Portfolio news avaiable.", styles["BodyText"],))

    story.append(Paragraph("All Market News", styles["SectionTitle"]))
    story.append(Paragraph("Latest general market and business news.", styles["NewsMeta"]))
    story.append(Spacer(1,8,))

    if market_news:
        for article in market_news[:5]:
            news_card = create_news_card(article, styles, show_ticker=True,)


            story.append(news_card)
            story.append(Spacer(1,10))

    else:
        story.append(Paragraph("No market news avaiable.", styles["BodyText"],))

    if analytics:
        story.append(Paragraph("Portfolio Analytics", styles["SectionTitle"],))
        story.append(Paragraph("Key financial and risk indicators", styles["NewsMeta"],))
        story.append(Spacer(1,8,))

        analytics_data = [ [
                "Ticker",
                "Company",
                "CAPM",
                "P/E",
                "Altman Z",
                "Beta",
                "RSI",
                "Sharpe",
                "Sortino",
            ] ]


        for stock in analytics:
            analytics_data.append([stock.get("ticker", "UnKnown"), stock.get("name", stock.get("ticker","Unknown",),), 
                get_indicator_value(stock.get("capm")),
                get_indicator_value(stock.get("pe_ratio")),
                get_indicator_value(stock.get("altman_z")),
                get_indicator_value(stock.get("beta")),
                get_indicator_value(stock.get("rsi")),
                get_indicator_value(stock.get("sharpe")),
                get_indicator_value(stock.get("sortino")),

                ])

        analytics_table = Table(
            analytics_data,
            repeatRows=1,
            colWidths=[
                19 * mm,
                29 * mm,
                18 * mm,
                17 * mm,
                20 * mm,
                16 * mm,
                16 * mm,
                19 * mm,
                19 * mm,
            ]
        )

        analytics_table.setStyle(TableStyle(
        [
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor('#E5E7EB'),),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold",),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold",),
            ("BOX", (0,0), (-1,-1),0.7, '#CBD5E1'),
            ("LEFTPADDING", (0,0), (-1,-1), 8,),
            ("RIGHTPADDING", (0,0), (-1,-1), 8,),
            ("TOPPADDING", (0,0), (-1,-1), 7,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7,),
        ]
        ))

        story.append(analytics_table)

        story.append(Spacer(1,8,))

    story.append(Paragraph("This report was generated from the same " "canonical portfolio snapshot used by Equity Lens", styles["BodyText"],))

    document.build(story, onFirstPage=add_front_page, onLaterPages=add_header_footer,)

    output.seek(0)

    return output
