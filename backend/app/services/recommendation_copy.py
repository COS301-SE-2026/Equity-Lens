CLOSE_GAP = 0.5

def _closest_traits(gaps: dict[str, float]) -> str:
    close = sorted((gap, name) for name, gap in gaps.items() if gap <= CLOSE_GAP)
    names = [name for _, name in close[:2]]
    return " and ".join(names) if names else "overall profile"

def describe_similar(rec: dict, source_sector: str, target_sector: str) -> str:
    pct = round(rec["closeness"] * 100)
    traits = _closest_traits(rec["gaps"])
    if target_sector == source_sector:
        return f"{pct}% match to {rec['similar_to']}: same sector ({target_sector}), similar {traits}"
    return f"{pct}% match to {rec['similar_to']}: similar {traits} despite a different sector ({target_sector})"