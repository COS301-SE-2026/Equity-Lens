import hashlib
import json
from datetime import date, datetime
from decimal import Decimal


def _normalise(value):
    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()
    
    if isinstance(value, dict):
        return {
            key: _normalise(value[key])
            for key in sorted(value)
        }

    if isinstance(value, list):
        return [_normalise(item) for item in value]

    return value

def canonical_json(data: dict):
    normalised = _normalise(data)

    return json.dumps(
        normalised,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,

    )


def create_snapshot_id(snapshot_data: dict):
    canonical = canonical_json(snapshot_data)

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()
    

def rank_insights(snapshot_data: dict):
    insights = []

    summary = snapshot_data.get("summary", {})
    holdings = snapshot_data.get("holdings", {})

    top_holdings = holdings.get("top", [])
    lowest = holdings.get("lowest")

    if top_holdings:
        insights.append({
            "type": "largest_holdings",
            "priority": 100,
            "title": "Largest Holdings",
            "data": top_holdings[0],
        })

    if summary.get("PortfolioValue") is not None:
        insights.append({
            "type": "portfolio_value",
            "priority": 90,
            "title": "Portfolio Value",
            "data": summary.get("PortfolioValue"),
        })

    if lowest:
        insights.append({
            "type": "smallest_holding",
            "priority": 60,
            "title": "Smallest Holding",
            "data": lowest,   
        })

    return sorted(
        insights,
        key= lambda item: item["priority"],
        reverse=True,
    )

def build_snapshot(
    portfolio_id: str,
    summary: dict,
    top_holdings: list,
    allocation: list,
    trading_activity: list,
    cash_flow: list,
    dividend_income: list,
    lowest_holding: dict,
    portfolio_news: list,
    market_news: list,
):

    snapshot_data = {
        "version": 1,

        "summary": summary,

        "holdings": {
            "top": top_holdings,
            "allocation": allocation,
            "lowest": lowest_holding,
        },

        "activity": {
            "trading": trading_activity,
            "cash_flow": cash_flow,
            "dividend_income": dividend_income
        },

        "news": {
            "portfolio": portfolio_news,
            "market": market_news,
        } 
    }

    snapshot_data["insights"] = rank_insights(snapshot_data)

    snapshot_id = create_snapshot_id(snapshot_data)

    return {
        "portfolio_id": portfolio_id,
        "snapshot_id": snapshot_id,
        "snapshot": snapshot_data,
    }


