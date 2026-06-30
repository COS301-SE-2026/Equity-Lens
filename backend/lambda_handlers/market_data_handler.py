import json
from typing import Any, Dict, Optional

from app.schemas.market_data import CurrentPriceParams, HistoryParams, SearchParams
from app.services.market_data_service import (
	get_current_price,
	get_historical_data,
	search_stocks,
)


def _json_response(status_code: int, payload: Dict[str, Any]) -> Dict[str, Any]:
	return {
		"statusCode": status_code,
		"headers": {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "Content-Type,Authorization",
			"Access-Control-Allow-Methods": "GET,OPTIONS",
		},
		"body": json.dumps(payload, default=str),
	}


def _get_query_param(event: Dict[str, Any], *names: str) -> Optional[str]:
	params = event.get("queryStringParameters") or {}
	for name in names:
		value = params.get(name)
		if value:
			return value
	return None


def _error_response(message: str, status_code: int = 400) -> Dict[str, Any]:
	return _json_response(status_code, {"detail": message})


def lambda_handler(event, _context):
	try:
		method = (event.get("httpMethod") or "GET").upper()
		if method == "OPTIONS":
			return _json_response(200, {})

		path = (event.get("path") or "").rstrip("/").lower()

		if "history" in path:
			symbol = _get_query_param(event, "symbol", "ticker")
			period = _get_query_param(event, "period") or "1mo"
			if not symbol:
				return _error_response("symbol is required")

			request = HistoryParams(symbol=symbol, period=period)
			result = get_historical_data(request.symbol, request.period)
			return _json_response(200, result.model_dump(mode="json"))

		if "search" in path:
			query = _get_query_param(event, "query", "q")
			if not query:
				return _error_response("query is required")

			request = SearchParams(query=query)
			result = search_stocks(request.query)
			return _json_response(200, result.model_dump(mode="json"))

		symbol = _get_query_param(event, "symbol", "ticker")
		if not symbol:
			return _error_response("symbol is required")

		request = CurrentPriceParams(symbol=symbol)
		result = get_current_price(request.symbol)
		return _json_response(200, result.model_dump(mode="json"))

	except Exception as exc:
		return _error_response(str(exc), 500)
