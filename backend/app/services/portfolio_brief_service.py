import io
import threading
from collections import OrderedDict
from datetime import UTC, date, datetime
from html import escape
from pathlib import Path

import requests
from matplotlib.figure import Figure
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.portfolio_brief_dashboard import (
    ACCENT,
    ACCENT_TEXT,
    DIM,
    FRAME_WIDTH,
    GRID_STYLE,
    HAIRLINE,
    INFO,
    INK,
    KEY_VALUE_STYLE,
    NEGATIVE,
    POSITIVE,
    RULE,
    SECONDARY,
    SECTION_COLOUR,
    add_dashboard_pages,
    dashboard_toc_rows,
    number_columns,
    pie_with_legend,
    style_chart,
)

NEWS_IMAGE_MAX_BYTES = 2 * 1024 * 1024
NEWS_IMAGE_SIZE = (540, 360)
NEWS_IMAGE_CACHE_SIZE = 32
_news_images: OrderedDict[str, bytes] = OrderedDict()
_news_images_lock = threading.Lock()

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "equitylens_logo.png"

VALUE_BASIS_NOTES = {
    "statement": "Value at statement date uses the closing values on your statement.",
    "mixed": "Some holdings had no closing value on the statement, so they count at cost.",
    "cost": "The statement had no closing values, so the value at statement date is what you "
    "paid (cost).",
}
OLD_SNAPSHOT_NOTE = (
    "This snapshot was saved before statement values were recorded, so amounts are at cost."
)

ANALYTICS_COLUMNS = [
    ("capm", "CAPM", "expected yearly return for the share's market risk (beta), in %."),
    ("pe_ratio", "P/E", "share price divided by earnings per share."),
    ("altman_z", "Altman Z", "balance-sheet distress score, higher is safer; "
     "not used for banks and funds."),
    ("beta", "Beta", "how strongly the share moves with the market, 1 moves in step."),
    ("rsi", "RSI", "14-day price momentum on a 0 to 100 scale."),
    ("sharpe", "Sharpe", "yearly return above the risk-free rate per unit of volatility."),
    ("sortino", "Sortino", "like Sharpe, but only falling days count as risk."),
]


def section_heading(number, title, color):
    data = [[f"{number:02d}", title]]

    table = Table(data, colWidths=[12 * mm, 168 * mm])

    table.setStyle(
        TableStyle([
            ("TEXTCOLOR", (0,0), (0,0), colors.HexColor(ACCENT_TEXT)),
            ("TEXTCOLOR", (1,0), (1,0), colors.HexColor(INK)),
            ("FONTNAME", (0,0), (-1,-1), "Helvetica-Bold",),
            ("FONTSIZE", (0,0), (-1,-1), 14,),
            ("LINEBELOW", (0,0), (-1,-1), 0.8, colors.HexColor(color)),
            ("VALIGN", (0,0), (-1,-1), "BOTTOM",),
            ("LEFTPADDING", (0,0), (-1,-1), 0,),
            ("TOPPADDING", (0,0), (-1,-1), 2,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6,),
        ])
    )

    return table


class NumberedCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._held_pages = []

    def showPage(self):  # noqa: N802 - reportlab's name
        self._held_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._held_pages)
        for page in self._held_pages:
            self.__dict__.update(page)
            if self._pageNumber > 1:
                self.setFont("Helvetica", 7.5)
                self.setFillColor(colors.HexColor(DIM))
                self.drawRightString(
                    A4[0] - 15 * mm, 10 * mm, f"Page {self._pageNumber} of {total}"
                )
            super().showPage()
        super().save()


def long_date(value):
    if not value:
        return None
    try:
        day = value if isinstance(value, date) else date.fromisoformat(str(value)[:10])
    except ValueError:
        return str(value)
    return f"{day.day} {day:%b %Y}"


def add_front_page(canvas, _doc, user_name, details=()):
    canvas.saveState()

    page_width, page_height = A4
    left = 20 * mm

    canvas.drawImage(
        str(LOGO_PATH),
        left,
        page_height - 40 * mm,
        width=16 * mm,
        height=16 * mm,
        preserveAspectRatio=True,
        mask="auto",
    )
    canvas.setFillColor(colors.HexColor(INK))
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawString(left + 20 * mm, page_height - 34 * mm, "EquityLens")

    title_y = page_height - 120 * mm
    canvas.setFont("Helvetica-Bold", 36)
    canvas.drawString(left, title_y, "Portfolio Summary")

    canvas.setStrokeColor(colors.HexColor(ACCENT))
    canvas.setLineWidth(2)
    canvas.line(left, title_y - 9 * mm, left + 32 * mm, title_y - 9 * mm)

    if user_name:
        canvas.setFillColor(colors.HexColor(SECONDARY))
        canvas.setFont("Helvetica", 14)
        canvas.drawString(left, title_y - 20 * mm, f"Prepared for {user_name}")

    row_y = 30 * mm + 14 * mm * (len(details) - 1)
    canvas.setLineWidth(0.5)
    for label, value in details:
        canvas.setStrokeColor(colors.HexColor(HAIRLINE))
        canvas.line(left, row_y + 9 * mm, page_width - left, row_y + 9 * mm)
        canvas.setFillColor(colors.HexColor(DIM))
        canvas.setFont("Helvetica", 9)
        canvas.drawString(left, row_y + 3 * mm, label)
        canvas.setFillColor(colors.HexColor(INK))
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawRightString(page_width - left, row_y + 3 * mm, value)
        row_y -= 14 * mm

    canvas.restoreState()

def add_header_footer(canvas, _doc, snapshot_id=""):

    canvas.saveState()

    page_width, page_height = A4

    canvas.drawImage(
        str(LOGO_PATH),
        15 * mm,page_height - 17 * mm,
        width=6 * mm,
        height=6 * mm,
        preserveAspectRatio=True,
        mask="auto",
    )

    canvas.setFont("Helvetica-Bold",9,)
    canvas.setFillColor(colors.HexColor(INK))
    canvas.drawString(23 * mm, page_height - 15 * mm, "EquityLens",)

    canvas.setFont("Helvetica",8,)
    canvas.setFillColor(colors.HexColor(DIM))
    canvas.drawRightString(page_width - 15 * mm, page_height - 15 * mm, "Portfolio Summary",)
    canvas.setStrokeColor(colors.HexColor(HAIRLINE))
    canvas.setLineWidth(0.5)
    canvas.line(15 * mm, page_height - 20 * mm, page_width - 15 * mm, page_height - 20 * mm,)
    canvas.line(15 * mm, 15 * mm, page_width - 15 * mm, 15 * mm)

    canvas.setFont("Helvetica",7.5,)
    parts = ("EquityLens", "Portfolio Summary", snapshot_id)
    footer = " \u00b7 ".join(part for part in parts if part)
    canvas.drawString(15 * mm, 10 * mm, footer)

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
    if not image_url or not image_url.startswith("https://"):
        return None

    with _news_images_lock:
        cached = _news_images.get(image_url)
    if cached is not None:
        return io.BytesIO(cached)

    try:
        with requests.get(image_url, timeout=(3, 5), stream=True, headers={
            "User-Agent": (
                "Mozilla/5.0 "
                "(Window NT 10.0; Win64; x64)"
            )
        },
        ) as response:

            response.raise_for_status()

            if int(response.headers.get("Content-Length") or 0) > NEWS_IMAGE_MAX_BYTES:
                return None

            body = bytearray()
            for chunk in response.iter_content(65536):
                body.extend(chunk)
                if len(body) > NEWS_IMAGE_MAX_BYTES:
                    return None

        image = PILImage.open(io.BytesIO(body))
        image.draft("RGB", NEWS_IMAGE_SIZE)

        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            flat = PILImage.new("RGB", image.size, "white")
            flat.paste(image, mask=image.getchannel("A"))
            image = flat
        else:
            image = image.convert("RGB")

        image.thumbnail(NEWS_IMAGE_SIZE)

        output_buffer = io.BytesIO()

        image.save(output_buffer, format="JPEG", quality=80, optimize=True)

    except Exception:
        return None

    with _news_images_lock:
        _news_images[image_url] = output_buffer.getvalue()
        while len(_news_images) > NEWS_IMAGE_CACHE_SIZE:
            _news_images.popitem(last=False)

    output_buffer.seek(0)

    return output_buffer

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

    all_together = []

    if source:
        all_together.append(source)

    if published_at:
        all_together.append(published_at)

    if all_together:
        text_content.append(Spacer(1,3))
        text_content.append(Paragraph(" \u00b7 ".join(all_together), styles["NewsMeta"],))

    if description:
        text_content.append(Spacer(1,6))
        text_content.append(Paragraph(description, styles["NewsDescription"],))

    if article_url:
        safe_url = escape(
            str(article_url), 
            {'"': "&quot;",},
            )

        text_content.append(Spacer(1,8))

        link_text = (
            f'<link href="{safe_url}" color="{INFO}">'
            "<b>Read full article</b>"
            "</link>"
        )

        text_content.append(
            Paragraph(
                link_text,
                styles["NewsLink"],
            )
        )

    image_buffer = get_news_image(image_url)

    if image_buffer:
        article_image = Image(image_buffer, width=42 *mm, height=28 * mm)
        card = Table([[article_image, text_content]], colWidths=[48 * mm, 132 * mm,],)
    else:
        card = Table([[text_content]], colWidths=[FRAME_WIDTH],)


    card.setStyle(TableStyle(
        [
            ("LINEBELOW", (0,0), (-1,-1), 0.5, colors.HexColor(HAIRLINE)),
            ("VALIGN", (0,0), (-1,-1), "TOP",),
            ("LEFTPADDING", (0,0), (0,-1), 0,),
            ("LEFTPADDING", (1,0), (-1,-1), 6,),
            ("RIGHTPADDING", (0,0), (-1,-1), 0,),
            ("TOPPADDING", (0,0), (-1,-1), 8,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 10,),
        ]
        ))

    return card


def _chart_buffer():
    return io.BytesIO()

def _bar_labels(ax, values):
    for row, value in enumerate(values):
        ax.text(value, row, f" R {value:,.0f} " if value >= 0 else f" -R {abs(value):,.0f} ",
                va="center", ha="left" if value >= 0 else "right", fontsize=8, color=INK)

def create_cash_flow_chart(allocation: list):
    labels = [item.get("name", "Unknown") for item in allocation]
    values = [float(item.get("value",0)) for item in allocation]

    buffer = _chart_buffer()

    fig = Figure(figsize=(6.5, 0.45 * len(values) + 0.9))
    ax = fig.subplots()

    ax.barh(labels, values, height=0.55,
            color=[POSITIVE if value >= 0 else NEGATIVE for value in values])
    ax.axvline(0, color=SECONDARY, linewidth=0.8)
    ax.invert_yaxis()
    _bar_labels(ax, values)
    ax.margins(x=0.2)
    style_chart(ax, grid="x")

    fig.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    buffer.seek(0)

    return buffer

def create_allocation_chart(allocation: list, title="Portfolio Allocation"):
    labels = [item.get("name", "Unknown") for item in allocation]
    values = [float(item.get("weight_percentage",0)) for item in allocation]

    buffer = _chart_buffer()

    fig = Figure(figsize=(6.5, 0.3 * len(values) + 1.2))
    ax = fig.subplots()

    pie_with_legend(ax, values, labels, title)

    fig.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    buffer.seek(0)

    return buffer

def create_trading_chart(trading: list):
    labels = [item.get("name", "Unknown") for item in trading]
    values = [float(item.get("value",0)) for item in trading]

    buffer = _chart_buffer()

    fig = Figure(figsize=(6.5, 0.45 * len(values) + 0.9))
    ax = fig.subplots()

    ax.barh(labels, values, height=0.55, color=ACCENT)
    ax.invert_yaxis()
    _bar_labels(ax, values)
    ax.margins(x=0.2)
    style_chart(ax, grid="x")

    fig.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    buffer.seek(0)

    return buffer

def create_dividend_chart(dividends: list):
    rows = sorted(dividends, key=lambda item: float(item.get("gross_dividend", 0)), reverse=True)
    labels = [item.get("name", "Unknown") for item in rows]
    gross = [float(item.get("gross_dividend",0)) for item in rows]
    net = [float(item.get("net_dividend",0)) for item in rows]
    tax = [
        float(item.get("withholding_tax", g - n))
        for item, g, n in zip(rows, gross, net, strict=True)
    ]

    buffer = _chart_buffer()

    fig = Figure(figsize=(6.5, 0.38 * len(rows) + 1.1))
    ax = fig.subplots()

    ax.barh(labels, net, height=0.55, color=ACCENT, label="Net dividend")
    ax.barh(labels, tax, left=net, height=0.55, color=RULE, label="Withholding tax")
    for row, total in enumerate(gross):
        ax.text(total, row, f" R {total:,.2f} gross", va="center", fontsize=8, color=INK)
    ax.invert_yaxis()
    ax.margins(x=0.25)
    ax.legend(fontsize=8, frameon=False, ncols=2, loc="lower left", bbox_to_anchor=(0, 1.0),
              labelcolor=SECONDARY)
    style_chart(ax, grid="x")

    fig.tight_layout()

    fig.savefig(buffer,format="png",dpi=160,bbox_inches="tight",)

    buffer.seek(0)

    return buffer

def _rand_text(value):
    return f"-R {abs(float(value)):,.2f}" if float(value) < 0 else f"R {float(value):,.2f}"


def _contents_table(rows):
    half = (len(rows) + 1) // 2
    left, right = rows[:half], rows[half:] + [["", ""]] * (half - len(rows[half:]))
    data = [[*a, *b] for a, b in zip(left, right, strict=True)]
    table = Table(data, colWidths=[10 * mm, 80 * mm, 10 * mm, 80 * mm])
    table.setStyle(TableStyle(
        [
            ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
            ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 9,),
            ("TEXTCOLOR", (0,0), (-1,-1), colors.HexColor(INK),),
            ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor(ACCENT_TEXT),),
            ("TEXTCOLOR", (2,0), (2,-1), colors.HexColor(ACCENT_TEXT),),
            ("LINEBELOW", (0,0), (1,-1), 0.5, colors.HexColor(HAIRLINE)),
            ("LINEBELOW", (2,0), (3,len(right) - 1), 0.5, colors.HexColor(HAIRLINE)),
            ("LEFTPADDING", (0,0), (-1,-1), 0,),
            ("TOPPADDING", (0,0), (-1,-1), 5,),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5,),
        ]
        ))
    return table


def _empty_note(text, styles):
    return Paragraph(text, styles["NewsDescription"])


def generate_portfolio_brief(
        portfolio_id: str,  # noqa: ARG001 - the route still passes it, the page shows the name
        snapshot_hash: str,
        snapshot: dict,
        user_name: str | None,
        portfolio_name: str | None = None,
        statement_date=None,
        account_last4: str | None = None,
    ):
    output = io.BytesIO()

    summary = snapshot.get("summary", {})
    dashboard = snapshot.get("dashboard") or {}
    statement = long_date(
        statement_date or summary.get("StatementDate") or dashboard.get("statementDate")
    )
    short_id = (snapshot_hash or "")[:12]

    cover_details = [
        (label, value)
        for label, value in (
            ("Portfolio", portfolio_name),
            ("Statement date", statement),
            ("Generated", long_date(datetime.now(UTC).date())),
        )
        if value
    ]

    def front_page(canvas, doc):
        add_front_page(canvas, doc, user_name, cover_details)

    def later_pages(canvas, doc):
        add_header_footer(canvas, doc, short_id)

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=28 * mm,
        bottomMargin=22 * mm,
        title="EquityLens Portfolio Summary",
        author="EquityLens",
    )

    styles = getSampleStyleSheet()
    styles["BodyText"].fontSize = 9.5
    styles["BodyText"].leading = 13
    styles["BodyText"].textColor = colors.HexColor(INK)

    styles.add(
        ParagraphStyle(
            name="SectionTitle", 
            parent=styles["Heading2"], 
            fontName="Helvetica-Bold", 
            fontSize=22, 
            leading=26, 
            textColor=colors.HexColor(INK), 
            spaceAfter=10,
            )
        )
    styles.add(
        ParagraphStyle(
            name="NewsTitle", 
            parent=styles["BodyText"], 
            fontName="Helvetica-Bold", 
            fontSize=10, leading=13, 
            textColor=colors.HexColor(INK)
            )
        )
    styles.add(
        ParagraphStyle(
            name="NewsMeta", 
            parent=styles["BodyText"], 
            fontSize=8, 
            leading=10, 
            textColor=colors.HexColor(DIM),
            )
        )
    styles.add(ParagraphStyle(
            name="NewsDescription", 
            parent=styles["BodyText"], 
            fontSize=9, 
            leading=12, 
            textColor=colors.HexColor(SECONDARY),
            )
        )
    styles.add(
        ParagraphStyle(
            name="NewsLink", 
            parent=styles["BodyText"], 
            fontSize=9, 
            leading=11,
            )
        )
    styles.add(
        ParagraphStyle(
            name="ContentsLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            spaceBefore=16,
            spaceAfter=6,
            )
        )


    story = []

    story.append(PageBreak())

    story.append(Paragraph("Portfolio Summary", styles["SectionTitle"]))

    about = [["Portfolio", portfolio_name or "Not named"]]
    if account_last4:
        about.append(["Account", f"ending {account_last4}"])
    about.append(["Statement date", statement or "Unknown"])
    about_table = Table(
        [[label, Paragraph(escape(str(value)), styles["BodyText"])] for label, value in about],
        colWidths=[60 * mm, 120 * mm],
    )
    about_table.setStyle(TableStyle([*KEY_VALUE_STYLE, ("ALIGN", (1,0), (1,-1), "LEFT")]))
    story.append(about_table)

    our_rows = dashboard_toc_rows(snapshot)
    offset = len(our_rows)
    snapshot_titles = [
        "Portfolio Summary",
        "Portfolio Allocation",
        "Top Holdings",
        "Trading Activity",
        "Dividend Income",
        "Cash Flow",
        "All Market News",
        "Portfolio Analytics",
    ]
    data = [*our_rows, *([f"{offset + n:02d}", t] for n, t in enumerate(snapshot_titles, 1))]

    story.append(Paragraph("In this report", styles["ContentsLabel"]))
    story.append(_contents_table(data))
    story.append(Spacer(1, 18))

    holdings = snapshot.get("holdings", {})
    activity = snapshot.get("activity", {})
    news = snapshot.get("news", {})
    market_news = news.get("market", [])
    analytics = snapshot.get("analytics", [])

    add_dashboard_pages(story, snapshot, styles, section_heading)

    statement_value = summary.get("StatementValue")
    summary_data = []
    if statement_value is not None:
        summary_data.append(["Value at statement date", _rand_text(statement_value)])
    summary_data += [
        [
            "Cost basis", 
            _rand_text(summary.get('PortfolioValue', 0)),
        ],
        [
            "Holdings", 
            str(summary.get('TotalHoldings', 0))
        ],
        [
            "Purchases and sales", 
            _rand_text(summary.get('TotalPurchasesAndSales', 0)),
        ],
        [
            "Contributions and withdrawals", 
            _rand_text(summary.get('TotalContributionsAndWithdrawals', 0)),
        ],
        [
            "Dividends (after tax)", 
            _rand_text(summary.get('TotalDividendsAndWithholdingTax', 0)),
        ],
        [
            "Expenses", 
            _rand_text(summary.get('TotalTransactionExpenses', 0)),
        ],
    ]
    if summary.get("StatementDate"):
        summary_data.append(["Statement date", long_date(summary["StatementDate"])])


    summary_table = Table(summary_data, colWidths=[100 * mm, 80 * mm,],)

    summary_table.setStyle(TableStyle(KEY_VALUE_STYLE))

    if statement_value is None:
        basis_note = OLD_SNAPSHOT_NOTE
    else:
        basis_note = VALUE_BASIS_NOTES.get(summary.get("ValueBasis"), "")

    story.append(CondPageBreak(60 * mm))
    story.append(KeepTogether([section_heading(
        offset + 1, "Portfolio Summary", SECTION_COLOUR),
        Spacer(1,8),summary_table, Spacer(1,4),
        Paragraph(basis_note, styles["NewsMeta"])]))
    story.append(Spacer(1,16))


    allocation = holdings.get(
        "allocation", [],
    )

    if allocation:
        if statement_value is None:
            allocation_title = "Share of cost"
        else:
            allocation_title = "Share of value at statement date"
        allocation_chart = (create_allocation_chart(allocation, allocation_title))
        allocation_body = Image(
            allocation_chart, width=FRAME_WIDTH, height=110 * mm, kind="proportional")
    else:
        allocation_body = _empty_note("There are no holdings to show.", styles)
    story.append(KeepTogether(
        [section_heading(offset + 2, "Portfolio Allocation", SECTION_COLOUR), Spacer(1,8),
         allocation_body]))
    story.append(Spacer(1,16))



    top_holdings = holdings.get("top", [],)
    value_label = "Cost basis" if statement_value is None else "Value at statement date"
    if top_holdings:
        holdings_data = [["Holding", value_label]]
        for holding in top_holdings:
            holdings_data.append(
                [
                    holding.get("name", "Unknown"), 
                    _rand_text(holding.get('value',0)),
                ]
            )

        holdings_table = Table(
            holdings_data,
            colWidths=[
                120 * mm,
                60 * mm,
            ],
            repeatRows=1,
        )

        holdings_table.setStyle(TableStyle([*GRID_STYLE, ("ALIGN", (1,0), (1,-1), "RIGHT")]))
        holdings_body = holdings_table
    else:
        holdings_body = _empty_note("There are no holdings to show.", styles)

    story.append(KeepTogether([section_heading(
        offset + 3, "Top Holdings", SECTION_COLOUR),Spacer(1,8),holdings_body]))
    story.append(Spacer(1,16))

    trading = activity.get("trading", [],)

    if trading:
        trading_chart = create_trading_chart(trading)
        trading_body = Image(trading_chart, width=FRAME_WIDTH, height=60 * mm, kind="proportional")
    else:
        trading_body = _empty_note("No trades in this statement.", styles)
    story.append(KeepTogether([section_heading(offset + 4, "Trading Activity", SECTION_COLOUR),
        Spacer(1,8),trading_body]))
    story.append(Spacer(1,16))

    dividends = activity.get("dividend_income", [],)

    if dividends:
        dividend_chart = create_dividend_chart(dividends)
        dividend_body = Image(dividend_chart, width=FRAME_WIDTH, height=110 * mm,
                              kind="proportional")
    else:
        dividend_body = _empty_note("No dividends in this statement.", styles)
    story.append(KeepTogether([section_heading(offset + 5, "Dividend Income", SECTION_COLOUR), 
        Spacer(1,8),dividend_body]))
    story.append(Spacer(1,16))

    cash_flow = activity.get("cash_flow", [],)

    if cash_flow:
        cash_flow_chart = create_cash_flow_chart(cash_flow)
        cash_flow_body = Image(cash_flow_chart, width=FRAME_WIDTH, height=60 * mm,
                               kind="proportional")
    else:
        cash_flow_body = _empty_note("No contributions or withdrawals in this statement.", styles)
    story.append(KeepTogether([section_heading(offset + 6, "Cash Flow", SECTION_COLOUR),
        Spacer(1,8),cash_flow_body]))
    story.append(Spacer(1,16))

    news_heading = [section_heading(offset + 7, "All Market News", SECTION_COLOUR), Spacer(1,4)]

    if market_news:
        cards = [create_news_card(article, styles, show_ticker=True,)
                 for article in market_news[:5]]
        story.append(CondPageBreak(60 * mm))
        story.append(KeepTogether([*news_heading, cards[0]]))
        story.extend(cards[1:])

    else:
        story.append(KeepTogether(
            [*news_heading, _empty_note("No market news available.", styles)]))

    story.append(Spacer(1,16))

    analytics_heading = section_heading(offset + 8, "Portfolio Analytics", SECTION_COLOUR)

    if analytics:
        company_style = ParagraphStyle(
            "AnalyticsCompany",
            parent=styles["BodyText"],
            fontSize=9,
            leading=11,
        )

        values = {
            key: [get_indicator_value(stock.get(key)) for stock in analytics]
            for key, _label, _legend in ANALYTICS_COLUMNS
        }
        columns = [
            column for column in ANALYTICS_COLUMNS if any(v != "N/A" for v in values[column[0]])
        ]

        analytics_data = [ ["Ticker", "Company", *(label for _key, label, _legend in columns)] ]

        for row, stock in enumerate(analytics):
            analytics_data.append(
                [
                    stock.get("ticker", "Unknown"),
                    Paragraph(
                        escape(str(stock.get("name") or stock.get("ticker", "Unknown"))),
                        company_style,
                    ),
                    *(values[key][row] for key, _label, _legend in columns),
                ])
        number_width = 18 * mm
        analytics_table = Table(
            analytics_data,
            repeatRows=1,
            colWidths=[22 * mm, FRAME_WIDTH - 22 * mm - number_width * len(columns)]
            + [number_width] * len(columns),
        )

        right = [("ALIGN", (col,0), (col,-1), "RIGHT") for col in number_columns(analytics_data)]
        analytics_table.setStyle(TableStyle([*GRID_STYLE, *right]))

        legend = [
            Paragraph(f"<b>{label}</b>: {escape(text)}", styles["NewsMeta"])
            for _key, label, text in columns
        ]

        story.append(KeepTogether([
            analytics_heading,
            Spacer(1, 8),
            analytics_table
        ]))
        story.append(Spacer(1,6))
        story.extend(legend)

    else:
        story.append(KeepTogether(
            [analytics_heading, Spacer(1, 8), _empty_note("No analytics available.", styles)]))

    story.append(Spacer(1,12))

    story.append(
        Paragraph
        (
            "This report was generated from the same " 
            "canonical portfolio snapshot used by EquityLens.", 
            styles["NewsMeta"],
            )
        )

    document.build(
        story,
        onFirstPage=front_page,
        onLaterPages=later_pages,
        canvasmaker=NumberedCanvas,
    )

    output.seek(0)

    return output
