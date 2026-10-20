import io
import math
import re
from datetime import date
from html import escape

from matplotlib.figure import Figure
from matplotlib.ticker import FuncFormatter, MaxNLocator
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.services.instruments import KIND_ETF, get_look_through_note
from app.services.portfolio_insights import LITTLE_EFFECT_PCT

INK = "#141414"
SECONDARY = "#424242"
DIM = "#5C5C5C"
HAIRLINE = "#E6E6E6"
RULE = "#D6D6D6"
TINT = "#F4F4F2"
ACCENT = "#FF6A00"
ACCENT_TEXT = "#B34700"
POSITIVE = "#00875A"
NEGATIVE = "#C62828"
WARNING = "#9A5B00"
INFO = "#1D5FBF"

SECTION_COLOUR = ACCENT
MAX_CONTRIBUTION_ROWS = 10
FRAME_WIDTH = 180 * mm
SECTION_MIN_SPACE = 70 * mm

CGT_REASONS = {
    "tfsa_exempt": "This is a tax-free savings account, so its gains are exempt from CGT.",
    "account_type_unknown": "Set the account type on the dashboard to see a CGT estimate.",
    "usd_fx_not_supported": "CGT estimates are not available for dollar accounts yet.",
    "no_holdings": "There are no holdings to estimate tax on.",
    "unpriced_holdings": "Some holdings could not be priced live, so no estimate is shown.",
    "cost_basis_incomplete": "The statement is missing the purchase cost for a holding.",
}

TABLE_PADDING = [
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]
KEY_VALUE_STYLE = [
    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor(SECONDARY)),
    ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor(INK)),
    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor(HAIRLINE)),
    *TABLE_PADDING,
]

GRID_STYLE = [
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(TINT)),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(SECONDARY)),
    ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor(INK)),
    ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor(RULE)),
    ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor(HAIRLINE)),
    *TABLE_PADDING,
]

NOT_ADVICE = "This assessment is descriptive and is not investment or tax advice."

MAX_HOLDING_ROWS = 15
HEALTH_COLOURS = [(8.5, POSITIVE), (7.0, INFO), (5.0, WARNING), (0.0, NEGATIVE)]
ACCOUNT_LABELS = {
    "zar": "Rand (ZAR) account",
    "tfsa": "Tax-free savings account",
    "usd": "US dollar account",
}
PRICE_SOURCE_LABELS = {"live": "Live", "statement": "Statement", "cost": "At cost"}

CELL_STYLE = ParagraphStyle(
    "DashboardCell", fontSize=8.5, leading=10.5, textColor=colors.HexColor(INK)
)
BODY_CELL = ParagraphStyle(
    "DashboardBodyCell", fontSize=9, leading=11.5, textColor=colors.HexColor(INK)
)
HOLDINGS_TABLE_STYLE = [
    ("ALIGN", (2, 0), (4, -1), "RIGHT"),
]
NUMBER_CELL = re.compile(r"^[-+]?(R )?[-+]?\d")

def _rand(value):
    if value is None:
        return "N/A"
    sign = "-" if value < 0 else ""
    return f"{sign}R {abs(float(value)):,.2f}"


def _pct(value):
    if value is None:
        return "Not enough history"
    return f"{float(value):+.2f}%"


def _text(value):
    return escape(str(value)) if value is not None else ""


def _key_value_table(rows):
    table = Table(rows, colWidths=[100 * mm, 80 * mm])
    table.setStyle(TableStyle(KEY_VALUE_STYLE))
    return table


def _is_number(cell):
    return isinstance(cell, str) and bool(NUMBER_CELL.match(cell))


def number_columns(rows):
    body = rows[1:]
    return [
        col for col in range(len(rows[0]))
        if any(_is_number(row[col]) for row in body)
        and all(_is_number(row[col]) or row[col] in ("N/A", "-") for row in body)
    ]


def _grid_table(rows, col_widths):
    scale = FRAME_WIDTH / sum(col_widths)
    table = Table(rows, colWidths=[width * scale for width in col_widths], repeatRows=1)
    right = [("ALIGN", (col, 0), (col, -1), "RIGHT") for col in number_columns(rows)]
    table.setStyle(TableStyle([*GRID_STYLE, *right]))
    return table


def _section(story, heading, *flowables):
    story.append(KeepTogether([heading, Spacer(1, 8), *flowables]))


def _subheading_paragraph(text, styles):
    return Paragraph(
        _text(text),
        ParagraphStyle(
            "DashboardSubheading",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=colors.HexColor(INK),
            spaceBefore=14,
            spaceAfter=6,
            keepWithNext=1,
        ),
    )


def _subheading(story, text, styles):
    story.append(_subheading_paragraph(text, styles))

def _note_style(styles):
    return ParagraphStyle(
        "DashboardNote",
        parent=styles["BodyText"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor(DIM),
    )


def rand_tick(value, _position=None):
    size = abs(value)
    if size >= 1_000_000:
        text = f"{size / 1_000_000:.1f}m"
    elif size >= 10_000:
        text = f"{size / 1_000:.0f}k"
    elif size >= 1_000:
        text = f"{size / 1_000:.1f}k"
    else:
        text = f"{size:.0f}"
    return f"{'-' if value < 0 else ''}R {text.replace('.0', '')}"


def chart_title(ax, text):
    ax.set_title(text, loc="left", fontsize=10, fontweight="bold", color=INK, pad=8)


def style_chart(ax, grid="y", money=True):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(RULE)
    ax.tick_params(colors=SECONDARY, labelsize=8, length=0, pad=4)
    ax.xaxis.label.set(color=SECONDARY, fontsize=8)
    ax.yaxis.label.set(color=SECONDARY, fontsize=8)
    ax.set_axisbelow(True)
    if grid:
        ax.grid(axis=grid, color=HAIRLINE, linewidth=0.6)
    if money:
        (ax.yaxis if grid == "y" else ax.xaxis).set_major_formatter(FuncFormatter(rand_tick))

def _health_colour(score):
    for floor, colour in HEALTH_COLOURS:
        if score >= floor:
            return colour
    return HEALTH_COLOURS[-1][1]

def _performance_chart(history, benchmark_label):
    points = [p for p in history if p.get("value") is not None]
    fig = Figure(figsize=(6.5, 2.8))
    ax = fig.subplots()
    names = [p["name"] for p in points]
    days = range(len(points))
    ax.plot(
        days,
        [p["value"] for p in points],
        color=ACCENT,
        linewidth=1.6,
        label="Your portfolio",
    )
    benchmark = [p.get("benchmark") for p in points]
    if any(b is not None for b in benchmark):
        ax.plot(
            days,
            benchmark,
            color=DIM,
            linewidth=1.2,
            linestyle="--",
            label=benchmark_label or "Benchmark",
        )
    ax.legend(fontsize=8, frameon=False, loc="lower left", bbox_to_anchor=(0, 1.0), ncols=2,
              labelcolor=SECONDARY)
    ax.xaxis.set_major_locator(MaxNLocator(6, integer=True))
    ax.xaxis.set_major_formatter(
        FuncFormatter(lambda day, _pos: names[int(day)] if 0 <= day < len(names) else "")
    )
    style_chart(ax)
    return _png(fig)


def _benchmark_note(history, benchmark_label):
    caption = f"Solid line: your portfolio. Dashed line: {benchmark_label or 'the benchmark'}."
    dated = [p for p in history if p.get("value") is not None and p.get("date")]
    benchmarked = [p for p in dated if p.get("benchmark") is not None]
    if not benchmarked:
        return caption
    first = date.fromisoformat(dated[0]["date"][:10])
    start = date.fromisoformat(benchmarked[0]["date"][:10])
    if (start - first).days > 7:
        caption += f" Benchmark data starts on {start.day} {start:%b %Y}."
    return caption

PIE_COLOURS = [ACCENT, INFO, POSITIVE, WARNING, DIM, RULE]

def _share_bars(ax, values, labels, title):
    total = sum(values)
    rows = sorted(zip(values, labels, strict=True), key=lambda row: row[0])
    shares = [value / total * 100 for value, _name in rows]
    ax.barh([_short(name) for _value, name in rows], shares, color=ACCENT, height=0.6)
    for row, share in enumerate(shares):
        ax.text(share, row, f" {share:.1f}%", va="center", fontsize=8, color=INK)
    ax.margins(x=0.12)
    style_chart(ax, grid="x", money=False)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _pos: f"{value:.0f}%"))
    chart_title(ax, title)

def pie_with_legend(ax, values, labels, title):
    if any(math.isnan(v) for v in values) or sum(values) <= 0:
        ax.text(0.5, 0.5, "Allocation data not available", ha="center", va="center",
                color=DIM, fontsize=9)
        ax.axis("off")
        chart_title(ax, title)
        return

    if len(values) > len(PIE_COLOURS):
        _share_bars(ax, values, labels, title)
        return

    total = sum(values) or 1
    wedges, _ = ax.pie(
        values,
        colors=PIE_COLOURS[:len(values)],
        startangle=90,
        counterclock=False,
        wedgeprops={"linewidth": 1.5, "edgecolor": "white", "width": 0.42},
    )
    ax.legend(
        wedges,
        [f"{name} ({value / total * 100:.1f}%)"
         for name, value in zip(labels, values, strict=True)],
        loc="center left",
        bbox_to_anchor=(1.0, 0.5),
        fontsize=8,
        frameon=False,
        labelcolor=INK,
    )
    chart_title(ax, title)

def _sector_chart(sectors):
    fig = Figure(figsize=(6.5, 2.8))
    ax = fig.subplots()
    pie_with_legend(
        ax,
        [s["percentage"] for s in sectors],
        [s["sector"] for s in sectors],
        "",
    )
    return _png(fig)


def _subscore_chart(subscores):
    labels = [s["label"] for s in subscores]
    values = [s["value"] for s in subscores]
    fig = Figure(figsize=(6.5, 2.0))
    ax = fig.subplots()
    ax.barh(labels, values, color=[_health_colour(v) for v in values], height=0.55)
    ax.set_xlim(0, 10)
    ax.invert_yaxis()
    ax.set_xlabel("Score out of 10")
    for row, value in enumerate(values):
        ax.text(value + 0.15, row, f"{value:.1f}", va="center", fontsize=8, color=INK)
    style_chart(ax, grid="x", money=False)
    return _png(fig)

def _glance(story, snapshot, styles, heading):
    dashboard = snapshot["dashboard"]
    summary = dashboard.get("summary") or {}
    returns = dashboard.get("returns") or {}
    holdings_count = returns.get("holdings_count", summary.get("num_holdings", 0))

    if summary.get("daily_change_pct") is None:
        todays_move = "No live prices today"
    else:
        change = _rand(summary.get("daily_change_value"))
        todays_move = f"{change} ({_pct(summary['daily_change_pct'])})"

    gain = _rand(summary.get("total_gain_loss"))
    priced_live = f"{returns.get('priced_live_count', 0)} of {holdings_count}"
    _section(
        story,
        heading,
        _key_value_table(
            [
                ["Value today (live prices)", _rand(summary.get("total_value"))],
                ["Cost basis", _rand(summary.get("total_cost"))],
                ["Unrealised gain / loss", f"{gain} ({_pct(summary.get('total_gain_loss_pct'))})"],
                ["Today's move", todays_move],
                ["Holdings priced live", priced_live],
                ["Account type", ACCOUNT_LABELS.get(dashboard.get("accountType"), "Not set")],
                ["Statement date", dashboard.get("statementDate") or "Unknown"],
            ]
        ),
    )

    _subheading(story, "Returns", styles)
    story.append(
        _key_value_table(
            [
                ["Simple return (live-priced holdings)", _pct(returns.get("simple_return_pct"))],
                ["Money-weighted return (XIRR)", _pct(returns.get("money_weighted_return_pct"))],
                ["Time-weighted return", _pct(returns.get("time_weighted_return_pct"))],
                ["Realised gain", _rand(returns.get("realised_gain"))],
                ["Net contributions", _rand(returns.get("net_contributions"))],
                ["Costs and fees", _rand(returns.get("total_costs"))],
            ]
        )
    )
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            "Money-weighted return counts when you deposited, so it is your personal result. "
            "Time-weighted return strips deposit timing out, so it compares fairly with an index.",
            _note_style(styles),
        )
    )
    history = dashboard.get("performanceHistory") or []
    if len(history) >= 2:
        chart = _performance_chart(history, dashboard.get("benchmarkLabel"))
        story.append(KeepTogether([
            _subheading_paragraph("Performance", styles),
            Image(chart, width=FRAME_WIDTH, height=90 * mm, kind="proportional"),
            Spacer(1, 4),
            Paragraph(
                _text(_benchmark_note(history, dashboard.get("benchmarkLabel"))),
                _note_style(styles),
            ),
        ]))

    sectors = dashboard.get("sectorAllocation") or []
    if sectors:
        story.append(KeepTogether([
            _subheading_paragraph("Sector allocation (live value)", styles),
            Image(_sector_chart(sectors), width=FRAME_WIDTH, height=85 * mm, kind="proportional"),
        ]))

def _health(story, snapshot, styles, heading):
    dashboard = snapshot["dashboard"]
    health = dashboard.get("health") or {}
    score = health.get("score")
    if score is None:
        _section(
            story, heading, Paragraph("There are no holdings to score yet.", styles["BodyText"])
        )
        return

    banner = Table(
        [[f"{score:.1f} / 10", health.get("label") or ""]], colWidths=[45 * mm, 135 * mm]
    )
    banner.setStyle(
        TableStyle(
            [
                ("TEXTCOLOR", (0, 0), (0, 0), colors.HexColor(INK)),
                ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor(_health_colour(score))),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (0, 0), 22),
                ("FONTSIZE", (1, 0), (1, 0), 13),
                ("LEADING", (0, 0), (0, 0), 26),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor(HAIRLINE)),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    _section(story, heading, banner)

    note = _note_style(styles)
    subscores = health.get("subscores") or []
    if subscores:
        story.append(Spacer(1, 10))
        story.append(
           Image(_subscore_chart(subscores), width=FRAME_WIDTH, height=55 * mm, kind="proportional")
        )
        story.append(Spacer(1, 8))

        rows = [["Measure", "Score", "What it means"]]
        for sub in subscores:
            rows.append(
                [
                    Paragraph(
                        f"<b>{_text(sub['label'])}</b><br/>{sub['weight'] * 100:.0f}% of the score",
                        note,
                    ),
                    f"{sub['value']:.1f}",
                    Paragraph(
                        f"{_text(sub['detail'])}<br/><i>Target: {_text(sub['target'])}.</i> "
                        f"{_text(sub['improvement'])}",
                        BODY_CELL,
                    ),
                ]
            )
        story.append(_grid_table(rows, [38 * mm, 16 * mm, 106 * mm]))

    notes = [
        (h["name"], get_look_through_note(h["ticker"]))
        for h in dashboard.get("holdings") or []
        if get_look_through_note(h["ticker"])
    ]
    if notes:
        _subheading(story, "Worth knowing about your holdings", styles)
        for name, text in notes:
            story.append(Paragraph(f"<b>{_text(name)}</b> - {_text(text)}", styles["BodyText"]))
            story.append(Spacer(1, 4))

def _holdings_table(holdings, total_value):
    rows = [["Holding", "Type", "Value", "Weight", "Gain/Loss", "Priced"]]
    for h in holdings[:MAX_HOLDING_ROWS]:
        kind = "ETF" if h.get("kind") == KIND_ETF else "Stock"
        weight = h["value"] / total_value * 100 if total_value else 0.0
        rows.append(
            [
                Paragraph(f"<b>{_text(h['name'])}</b><br/>{_text(h['ticker'])}", CELL_STYLE),
                Paragraph(f"{kind}<br/>{_text(h.get('region'))}", CELL_STYLE),
                _rand(h["value"]),
                f"{weight:.1f}%",
                _pct(h["gain_loss_pct"]),
                PRICE_SOURCE_LABELS.get(h.get("price_source"), "-"),
            ]
        )
    table = Table(
        rows, colWidths=[60 * mm, 32 * mm, 30 * mm, 18 * mm, 22 * mm, 18 * mm], repeatRows=1
    )
    table.setStyle(TableStyle([*GRID_STYLE, *HOLDINGS_TABLE_STYLE]))
    return table

def _cgt_section(story, cgt, styles, note):
    _subheading(story, "Capital Gains Tax Estimate", styles)

    if not cgt.get("available"):
        fallback = "A capital gains tax estimate isn't available for this portfolio."
        reason = CGT_REASONS.get(cgt.get("reason"), fallback)
        story.append(Paragraph(_text(reason), styles["BodyText"]))
        return

    rows = [["Net unrealised gain", _rand(cgt.get("net_unrealised_gain"))]]
    if cgt.get("assessed_capital_loss") is not None:
        rows.append(["Assessed capital loss", _rand(cgt["assessed_capital_loss"])])
    else:
        rows.append(
            ["Added to taxable income if sold today", _rand(cgt.get("taxable_capital_gain"))]
        )
    story.append(_key_value_table(rows))
    story.append(Spacer(1, 4))

    assumptions = cgt.get("assumptions") or {}
    exclusion = float(assumptions.get("annual_exclusion", 0))
    inclusion_pct = float(assumptions.get("inclusion_rate", 0)) * 100
    story.append(
        Paragraph(
            f"Tax year {_text(assumptions.get('tax_year'))}. The first R{exclusion:,.0f} of net "
            f"gain is excluded and {inclusion_pct:.0f}% of the rest is added to your taxable "
            "income, using average cost. Estimated as if every holding were sold today.",
            note,
        )
    )
    statement_only = cgt.get("holdings_from_statement_only") or []
    if statement_only:
        story.append(
            Paragraph(
                f"Cost for {_text(', '.join(statement_only))} comes from the statement, "
                "not your trade history.",
                note,
            )
        )


def _holdings_and_tax(story, snapshot, styles, heading):
    dashboard = snapshot["dashboard"]
    holdings = sorted(dashboard.get("holdings") or [], key=lambda h: h["value"], reverse=True)
    note = _note_style(styles)

    if holdings:
        flowables = [_holdings_table(holdings, sum(h["value"] for h in holdings))]
        hidden = len(holdings) - MAX_HOLDING_ROWS
        if hidden > 0:
            plural = "s" if hidden != 1 else ""
            flowables += [Spacer(1, 4), Paragraph(f"Plus {hidden} smaller holding{plural}.", note)]
        _section(story, heading, *flowables)
    else:
        _section(story, heading, Paragraph("There are no holdings to show.", styles["BodyText"]))

    _cgt_section(story, dashboard.get("cgt") or {}, styles, note)
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "These figures are estimates for information only "
            "and are not tax or investment advice.",
            note,
        )
    )


def _risk_overview(story, snapshot, styles, heading):
    risk = snapshot["risk"]
    if not risk.get("available"):
        _section(story, heading, Paragraph(_text(risk.get("reason")), styles["BodyText"]))
        return

    var = risk["var"]
    drawdown = risk["drawdown"]
    concentration = risk["concentration"]

    _section(
        story,
        heading,
        _key_value_table(
            [
                ["Overall Risk Score", f"{risk['score']} / 100"],
                ["Risk Level", risk["level"]],
            ]
        ),
        Spacer(1, 6),
        Paragraph(
            "Combines bad-day loss risk, downside volatility, historical drawdown, "
            "concentration and reliance on a single holding. Higher means riskier.",
            styles["BodyText"],
        ),
    )

    _subheading(story, "Risk Measures", styles)
    story.append(
        _grid_table(
            [
                ["Measure", "Result", "Meaning"],
                [
                    f"{var['confidence_pct']}% Value at Risk",
                    _rand(var["value"]),
                    Paragraph(
                        f"On 1 day in 20, a loss bigger than this ({var['pct']:.2f}%)",
                        BODY_CELL,
                    ),
                ],
                [
                    "Downside Risk",
                    f"{risk['downside_deviation_pct']:.1f}%",
                    Paragraph("Yearly volatility of the losing days only", BODY_CELL),
                ],
                [
                    "Maximum Drawdown",
                    f"{drawdown['max_drawdown_pct']:.1f}%",
                    Paragraph(
                        "Biggest fall from a peak over the past year, replaying today's holdings",
                        BODY_CELL,
                    ),
                ],
                [
                    "HHI Concentration",
                    f"{concentration['hhi']:.2f}",
                    Paragraph(_text(concentration["assessment"]), BODY_CELL),
                ],
            ],
            [50 * mm, 30 * mm, 80 * mm],
        )
    )

    _subheading(story, "Main Risk Flags", styles)
    for flag in risk["flags"] or ["No major risk flags."]:
        story.append(Paragraph(f"&bull; {_text(flag)}", styles["BodyText"]))
        story.append(Spacer(1, 4))


def _cgt_text(cgt):
    if not cgt.get("available"):
        fallback = "A capital gains tax estimate isn't available for this portfolio."
        return CGT_REASONS.get(cgt.get("reason"), fallback)

    assumptions = cgt.get("assumptions") or {}
    basis = (
        f"Tax year {assumptions.get('tax_year')}, first "
        f"R{float(assumptions.get('annual_exclusion', 0)):,.0f} excluded, "
        f"{float(assumptions.get('inclusion_rate', 0)) * 100:.0f}% inclusion, average cost."
    )
    if cgt.get("assessed_capital_loss") is not None:
        return (
            f"Selling everything today would realise a capital loss of "
            f"{_rand(cgt['assessed_capital_loss'])}, which can be carried forward. {basis}"
        )
    return (
        f"Net unrealised gain of {_rand(cgt.get('net_unrealised_gain'))}. Selling everything "
        f"today would add about {_rand(cgt.get('taxable_capital_gain'))} to your taxable "
        f"income. {basis}"
    )


def _final_summary(risk):
    drivers = sorted(risk["parts"], key=lambda part: part["points"], reverse=True)[:2]
    text = (
        f"The portfolio is classified as {risk['level']} risk ({risk['score']} / 100), "
        f"driven mostly by {drivers[0]['label']} and {drivers[1]['label']}."
    )
    if risk["contributions"]:
        top = risk["contributions"][0]
        text += (
            f" {top['name']} is the largest risk driver, at "
            f"{top['contribution_pct']:.0f}% of total risk."
        )
    return text


def _drivers_and_tax(story, snapshot, styles, heading):
    risk = snapshot["risk"]
    cgt = (snapshot.get("dashboard") or {}).get("cgt") or {}

    if risk.get("available"):
        rows = [["Holding", "Share of Value", "Share of Risk", "Flag"]]
        for row in risk["contributions"][:MAX_CONTRIBUTION_ROWS]:
            rows.append(
                [
                    Paragraph(_text(row["name"]), BODY_CELL),
                    f"{row['weight_pct']:.1f}%",
                    f"{row['contribution_pct']:.1f}%",
                    row["flag"],
                ]
            )
        _section(
            story,
            heading,
            Paragraph(
                "How much of the portfolio's total volatility comes from each holding. "
                "A holding whose share of risk is well above its share of value is elevated.",
                styles["BodyText"],
            ),
            Spacer(1, 8),
            _grid_table(rows, [65 * mm, 30 * mm, 30 * mm, 35 * mm]),
        )
    else:
        _section(story, heading, Paragraph(_text(risk.get("reason")), styles["BodyText"]))

    _subheading(story, "Capital Gains Tax Estimate", styles)
    story.append(Paragraph(_text(_cgt_text(cgt)), styles["BodyText"]))

    if risk.get("available"):
        _subheading(story, "Summary", styles)
        story.append(Paragraph(_text(_final_summary(risk)), styles["BodyText"]))

    story.append(Spacer(1, 8))
    story.append(Paragraph(NOT_ADVICE, styles["BodyText"]))



MAX_HOLDING_BARS = 8
MAX_NAME_CHARS = 28

DRIVER_WORDS = {"jse": "the JSE Top 40", "rand": "the rand", "gold": "gold", "oil": "oil"}
DRIVER_MOVES = {
    "jse": "the JSE Top 40 rises {shock:.0f}%",
    "rand": "the rand weakens so that a dollar costs {shock:.0f}% more",
    "gold": "the gold price rises {shock:.0f}%",
    "oil": "the oil price rises {shock:.0f}%",
}
MOVE_TARGETS = {1: "it", 2: "either of them"}


def _signed(value):
    return f"{round(value, 1) or 0.0:+.1f}%"


def _points(value):
    return f"{round(value, 1) or 0.0:+.1f} pts"


def _join(words):
    return words[0] if len(words) == 1 else f"{', '.join(words[:-1])} and {words[-1]}"


def _short(name):
    return name if len(name) <= MAX_NAME_CHARS else f"{name[:MAX_NAME_CHARS - 1].rstrip()}..."


def _reaction_of(row):
    return row.get("reaction", "clear" if row["clear"] else "unclear")


def _png(fig):
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=160, bbox_inches="tight")
    buffer.seek(0)
    return buffer


def _holding_bars(holdings):
    if len(holdings) <= MAX_HOLDING_BARS:
        return [(_short(h["name"]), h["contribution_pct"]) for h in holdings]

    by_size = sorted(holdings, key=lambda h: abs(h["contribution_pct"]), reverse=True)
    shown = {h["ticker"] for h in by_size[: MAX_HOLDING_BARS - 1]}
    bars = [(_short(h["name"]), h["contribution_pct"]) for h in holdings if h["ticker"] in shown]
    rest = [h["contribution_pct"] for h in holdings if h["ticker"] not in shown]
    bars.append((f"{len(rest)} other holdings", sum(rest)))
    return bars


def _holdings_chart(holdings):
    bars = _holding_bars(holdings)[::-1] 
    values = [value for _name, value in bars]

    fig = Figure(figsize=(6.5, 0.32 * len(bars) + 1.0))
    ax = fig.subplots()
    ax.barh(
        [name for name, _value in bars],
        values,
        color=[POSITIVE if value >= 0 else NEGATIVE for value in values],
        height=0.6,
    )
    for index, value in enumerate(values):
        ax.text(value, index, f" {_points(value)} ", va="center",
                ha="left" if value >= 0 else "right", fontsize=8, color=INK)
    ax.axvline(0, color=SECONDARY, linewidth=0.8)
    ax.set_xlabel("Share of your return (percentage points)")
    chart_title(ax, "Which holdings made the money")
    ax.margins(x=0.25)
    style_chart(ax, grid="x", money=False)
    return _png(fig), fig.get_figheight() / fig.get_figwidth()


def _drivers_headline(drivers):
    total = drivers.get("holdings_return_pct", drivers["total_return_pct"])
    text = (
        f"Over the past {drivers['weeks']} weeks, the shares you hold today returned "
        f"{_signed(total)}."
    )
    jse = next((row for row in drivers["drivers"] if row["key"] == "jse"), None)
    if jse is None:
        return text
    gap = total - jse["factor_move_pct"]
    return text + (
        f" The JSE Top 40 returned {_signed(jse['factor_move_pct'])} over the same weeks, so "
        f"your holdings finished {abs(gap):.1f} points {'ahead of' if gap >= 0 else 'behind'} "
        f"the market."
    )


def _moved(holding):
    return f"{'up' if holding['return_pct'] >= 0 else 'down'} {abs(holding['return_pct']):.1f}%"


def _holding_lines(holdings):
    if not holdings:
        return []
    lines = []
    best, worst = holdings[0], holdings[-1]
    if best["contribution_pct"] > 0:
        lines.append(
            f"{best['name']} did the most work: {_moved(best)}, adding "
            f"{best['contribution_pct']:.1f} points from {best['weight_pct']:.0f}% "
            f"of the portfolio."
        )
    if worst["contribution_pct"] < 0:
        lines.append(
            f"{worst['name']} held you back the most: {_moved(worst)}, costing "
            f"{abs(worst['contribution_pct']):.1f} points."
        )
    return lines

def _reaction_lines(rows, shock):
    lines = []
    for row in rows:
        if _reaction_of(row) != "clear":
            continue
        move = DRIVER_MOVES.get(row["key"], "{shock:.0f}% move").format(shock=shock)
        direction = "rise" if row["sensitivity_pct"] >= 0 else "fall"
        lines.append(
            f"When {move}, your portfolio tends to {direction} "
            f"{abs(row['sensitivity_pct']):.1f}%."
        )

    little = [DRIVER_WORDS.get(r["key"], r["key"]) for r in rows if _reaction_of(r) == "little"]
    if little:
        lines.append(
            f"Your portfolio barely reacts to {_join(little)}: a {shock:.0f}% move in "
            f"{MOVE_TARGETS.get(len(little), 'any of them')} shifts it by less than "
            f"{LITTLE_EFFECT_PCT:.0f}% either way."
        )

    unclear = [DRIVER_WORDS.get(r["key"], r["key"]) for r in rows if _reaction_of(r) == "unclear"]
    if unclear:
        lines.append(
            f"The link to {_join(unclear)} is too noisy to measure over this period."
        )
    return lines


def _scenario_table(scenarios, _styles):
    rows = [["If...", "Your portfolio", "In rand", "Likely range"]]
    for scenario in scenarios:
        rows.append(
            [
                Paragraph(_text(scenario["name"]), BODY_CELL),
                _signed(scenario["effect_pct"]),
                _rand(scenario["effect_value"]),
                f"{_signed(scenario['low_pct'])} to {_signed(scenario['high_pct'])}",
            ]
        )
    table = _grid_table(rows, [70 * mm, 28 * mm, 30 * mm, 32 * mm])
    for index, scenario in enumerate(scenarios, start=1):
        colour = POSITIVE if scenario["effect_pct"] >= 0 else NEGATIVE
        table.setStyle(TableStyle([("TEXTCOLOR", (1, index), (2, index), colors.HexColor(colour))]))
    return table


def _bullets(story, lines, styles):
    for line in lines:
        story.append(Paragraph(f"&bull; {_text(line)}", styles["BodyText"]))
        story.append(Spacer(1, 4))


def _market_drivers(story, snapshot, styles, heading):
    drivers = snapshot["drivers"]
    if not drivers.get("available"):
        _section(story, heading, Paragraph(_text(drivers.get("reason")), styles["BodyText"]))
        return

    holdings = drivers.get("holdings") or []
    flowables = [Paragraph(_text(_drivers_headline(drivers)), styles["BodyText"])]
    if holdings:
        chart, aspect = _holdings_chart(holdings)
        flowables += [
            Spacer(1, 8),
            Image(chart, width=FRAME_WIDTH, height=FRAME_WIDTH * aspect, kind="proportional"),
        ]
    _section(story, heading, *flowables)
    story.append(Spacer(1, 6))
    _bullets(story, _holding_lines(holdings), styles)

    _subheading(story, "What your portfolio reacts to", styles)
    _bullets(story, _reaction_lines(drivers["drivers"], drivers["shock_pct"]), styles)

    scenarios = drivers.get("scenarios")
    if scenarios:
        _subheading(story, "What if...?", styles)
        story.append(_scenario_table(scenarios, styles))

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"Based on the shares you hold today over the past {drivers['weeks']} weeks. "
        f"Reactions and scenarios come from how your portfolio moved alongside the JSE, the "
        f"rand, gold and oil; these relationships shift over time, and the likely range "
        f"covers about 9 outcomes in 10 if they hold. {NOT_ADVICE}",
        styles["BodyText"],
    ))


def _sections(snapshot):
    sections = []
    if snapshot.get("drivers"):
        sections.append(("What Moves Your Money", _market_drivers))
    if snapshot.get("dashboard"):
        sections += [
            ("Portfolio at a Glance", _glance),
            ("Portfolio Health", _health),
            ("Holdings and Tax", _holdings_and_tax),
        ]
    if snapshot.get("risk"):
        sections += [
            ("Risk Assessment", _risk_overview),
            ("Risk Drivers and Tax", _drivers_and_tax),
        ]
    return sections


def dashboard_toc_rows(snapshot):
    return [[f"{number:02d}", title] for number, (title, _) in enumerate(_sections(snapshot), 1)]


def add_dashboard_pages(story, snapshot, styles, heading):
    for number, (title, render) in enumerate(_sections(snapshot), 1):
        story.append(CondPageBreak(SECTION_MIN_SPACE))
        render(story, snapshot, styles, heading(number, title, SECTION_COLOUR))
        story.append(Spacer(1, 16))
