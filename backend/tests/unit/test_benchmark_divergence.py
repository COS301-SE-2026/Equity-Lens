from datetime import date, timedelta

from app.services.event_detection import MIN_OBSERVATIONS
from app.services.portfolio_service import _divergences, _relative_levels


def _history(rows: list[tuple[float, float]], start: date = date(2026, 1, 1)) -> list[dict]:
    """(twr_index, benchmark) pairs on consecutive days, in the shape the chart series has."""
    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "name": "x",
            "value": twr * 1000,
            "twr_index": twr,
            "benchmark": bench,
        }
        for i, (twr, bench) in enumerate(rows)
    ]


def test_the_relative_return_is_the_difference_of_the_two_log_returns():
    levels = _relative_levels(_history([(100.0, 100.0), (104.8, 100.7)]))

    assert levels[0][1] == 100.0
    assert levels[1][1] == 104.0715 or abs(levels[1][1] - 104.0715) < 0.001
    assert abs((levels[1][1] / levels[0][1] - 1) * 100 - 4.07) < 0.01


def test_a_deposit_day_is_not_a_divergence():
    history = _history([(100.0, 100.0), (100.0, 100.0)])
    history[1]["value"] = 200000 

    levels = _relative_levels(history)

    assert levels[1][1] == levels[0][1]


def test_a_short_history_says_it_could_not_look_rather_than_finding_nothing():
    short = _history([(100.0 + i * 0.1, 100.0) for i in range(MIN_OBSERVATIONS - 10)])

    divergences, coverage = _divergences(short, 3.0)

    assert divergences == []
    assert coverage["available"] is False
    assert coverage["reason"] == "insufficient_history"


def test_one_unusual_day_among_quiet_ones_is_found_and_named():
    twr, bench = 100.0, 100.0
    rows = []
    for i in range(200):
        twr *= 1.001 + (0.0004 if i % 2 else -0.0004)
        bench *= 1.001
        rows.append((twr, bench))
    rows.append((twr * 1.05, bench))

    divergences, coverage = _divergences(_history(rows), 3.0)

    assert coverage["available"] is True
    assert len(divergences) >= 1
    biggest = divergences[0]
    assert biggest["direction"] == "ahead"
    assert biggest["relative_return_pct"] > 4
    assert biggest["observations"] == coverage["observations"]
