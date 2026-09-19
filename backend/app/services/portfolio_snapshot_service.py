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
    