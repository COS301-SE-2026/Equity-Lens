import io
from html import escape

import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from app.services.instruments import KIND_ETF, get_look_through_note
from app.services.portfolio_insights import LITTLE_EFFECT_PCT

SECTION_COLOUR = "#2563EB"
MAX_CONTRIBUTION_ROWS = 10

CGT_REASONS = {
    "tfsa_exempt": "This is a tax-free savings account, so its gains are exempt from CGT.",
    "account_type_unknown": "Set the account type on the dashboard to see a CGT estimate.",
    "usd_fx_not_supported": "CGT estimates are not available for dollar accounts yet.",
    "no_holdings": "There are no holdings to estimate tax on.",
    "unpriced_holdings": "Some holdings could not be priced live, so no estimate is shown.",
    "cost_basis_incomplete": "The statement is missing the purchase cost for a holding.",
}

KEY_VALUE_STYLE = [
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]

GRID_STYLE = [
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]

NOT_ADVICE = "This assessment is descriptive and is not investment or tax advice."

MAX_HOLDING_ROWS = 15
HEALTH_COLOURS = [(8.5, "#16A34A"), (7.0, "#0D9488"), (5.0, "#D97706"), (0.0, "#DC2626")]
ACCOUNT_LABELS = {
    "zar": "Rand (ZAR) account",
    "tfsa": "Tax-free savings account",
    "usd": "US dollar account",
}
PRICE_SOURCE_LABELS = {"live": "Live", "statement": "Statement", "cost": "At cost"}

CELL_STYLE = ParagraphStyle("DashboardCell", fontSize=8, leading=10)
HOLDINGS_TABLE_STYLE = [
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ("ALIGN", (2, 1), (4, -1), "RIGHT"),
]

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
    table = Table(rows, colWidths=[90 * mm, 70 * mm])
    table.setStyle(TableStyle(KEY_VALUE_STYLE))
    return table


def _grid_table(rows, col_widths):
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(GRID_STYLE))
    return table


def _section(story, heading, *flowables):
    story.append(KeepTogether([heading, Spacer(1, 8), *flowables]))


def _subheading(story, text, styles):
    story.append(Spacer(1, 15))
    story.append(Paragraph(f"<b>{text}</b>", styles["BodyText"]))
    story.append(Spacer(1, 6))

def _note_style(styles):
    return ParagraphStyle(
        "DashboardNote",
        parent=styles["BodyText"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748B"),
    )

def _health_colour(score):
    for floor, colour in HEALTH_COLOURS:
        if score >= floor:
            return colour
    return HEALTH_COLOURS[-1][1]

def _performance_chart(history, benchmark_label):
    points = [p for p in history if p.get("value") is not None]
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.plot([p["name"] for p in points], [p["value"] for p in points], label="Your portfolio")
    benchmark = [p.get("benchmark") for p in points]
    if any(b is not None for b in benchmark):
        ax.plot(
            [p["name"] for p in points],
            benchmark,
            linestyle="--",
            label=benchmark_label or "Benchmark",
        )
    ax.set_ylabel("Value (ZAR)")
    ax.legend(fontsize=8)
    ax.xaxis.set_major_locator(plt.MaxNLocator(6))
    return _png(fig)

def _sector_chart(sectors):
    fig, ax = plt.subplots(figsize=(6, 3.5))
    ax.pie(
        [s["percentage"] for s in sectors],
        labels=[s["sector"] for s in sectors],
        autopct="%1.1f%%",
        startangle=90,
    )
    ax.set_title("Sector Allocation (live value)")
    return _png(fig)


def _subscore_chart(subscores):
    labels = [s["label"] for s in subscores]
    values = [s["value"] for s in subscores]
    fig, ax = plt.subplots(figsize=(6, 2.2))
    ax.barh(labels, values, color=[_health_colour(v) for v in values])
    ax.set_xlim(0, 10)
    ax.invert_yaxis()
    ax.set_xlabel("Score out of 10")
    for row, value in enumerate(values):
        ax.text(value + 0.15, row, f"{value:.1f}", va="center", fontsize=9)
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
                ["Live value", _rand(summary.get("total_value"))],
                ["Invested (cost)", _rand(summary.get("total_cost"))],
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
        story.append(Spacer(1, 12))
        story.append(Image(chart, width=160 * mm, height=80 * mm, kind="proportional"))

    sectors = dashboard.get("sectorAllocation") or []
    if sectors:
        story.append(Spacer(1, 8))
        story.append(
            Image(_sector_chart(sectors), width=150 * mm, height=85 * mm, kind="proportional")
        )

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
        [[f"{score:.1f} / 10", health.get("label") or ""]], colWidths=[55 * mm, 105 * mm]
    )
    banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(_health_colour(score))),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (0, 0), 22),
                ("FONTSIZE", (1, 0), (1, 0), 14),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    _section(story, heading, banner)

    note = _note_style(styles)
    subscores = health.get("subscores") or []
    if subscores:
        story.append(Spacer(1, 10))
        story.append(
           Image(_subscore_chart(subscores), width=150 * mm, height=55 * mm, kind="proportional")
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
                        styles["BodyText"],
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
        rows, colWidths=[52 * mm, 30 * mm, 28 * mm, 16 * mm, 18 * mm, 16 * mm], repeatRows=1
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
                        styles["BodyText"],
                    ),
                ],
                [
                    "Downside Risk",
                    f"{risk['downside_deviation_pct']:.1f}%",
                    Paragraph("Yearly volatility of the losing days only", styles["BodyText"]),
                ],
                [
                    "Maximum Drawdown",
                    f"{drawdown['max_drawdown_pct']:.1f}%",
                    Paragraph(
                        "Biggest fall from a peak over the past year, replaying today's holdings",
                        styles["BodyText"],
                    ),
                ],
                [
                    "HHI Concentration",
                    f"{concentration['hhi']:.2f}",
                    Paragraph(_text(concentration["assessment"]), styles["BodyText"]),
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
                    Paragraph(_text(row["name"]), styles["BodyText"]),
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



POSITIVE = "#16A34A"
NEGATIVE = "#DC2626"
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
    plt.close(fig)
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

    fig, ax = plt.subplots(figsize=(6.5, 0.4 * len(bars) + 1.0))
    ax.barh(
        [name for name, _value in bars],
        values,
        color=[POSITIVE if value >= 0 else NEGATIVE for value in values],
    )
    for index, value in enumerate(values):
        ax.text(value, index, f" {_points(value)} ", va="center",
                ha="left" if value >= 0 else "right", fontsize=8)
    ax.axvline(0, color="#64748B", linewidth=0.8)
    ax.set_xlabel("Share of your return (percentage points)")
    ax.set_title("Which holdings made the money")
    ax.margins(x=0.25)
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


def _scenario_table(scenarios, styles):
    rows = [["If...", "Your portfolio", "In rand", "Likely range"]]
    for scenario in scenarios:
        rows.append(
            [
                Paragraph(_text(scenario["name"]), styles["BodyText"]),
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
            Image(chart, width=160 * mm, height=160 * mm * aspect, kind="proportional"),
        ]
    _section(story, heading, *flowables)
    story.append(Spacer(1, 6))
    _bullets(story, _holding_lines(holdings), styles)

    _subheading(story, "What your portfolio reacts to", styles)
    _bullets(story, _reaction_lines(drivers["drivers"], drivers["shock_pct"]), styles)

    scenarios = drivers.get("scenarios")
    if scenarios:
        story.append(Spacer(1, 15))
        story.append(KeepTogether([
            Paragraph("<b>What if...?</b>", styles["BodyText"]),
            Spacer(1, 6),
            _scenario_table(scenarios, styles),
        ]))

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
    return [[f"{number}.", title] for number, (title, _) in enumerate(_sections(snapshot), 1)]


def add_dashboard_pages(story, snapshot, styles, heading):
    for number, (title, render) in enumerate(_sections(snapshot), 1):
        render(story, snapshot, styles, heading(number, title, SECTION_COLOUR))
        story.append(PageBreak())
