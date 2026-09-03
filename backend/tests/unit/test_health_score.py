import pytest
from app.services import health_score
from app.services.instruments import KIND_ETF, KIND_STOCK


@pytest.fixture
def make_holding():
    """Factory fixture to build holding dicts with sensible defaults."""
    def _factory(ticker, value, sector, kind=KIND_STOCK, region="South Africa", priced_live=True):
        return {
            "ticker": ticker,
            "value": value,
            "sector": sector,
            "kind": kind,
            "region": region,
            "priced_live": priced_live,
        }
    return _factory


@pytest.fixture
def sample_portfolio(make_holding):
    """Standard multi-asset book used across scoring tests."""
    return [
        make_holding("NPN.JO", 5000, "Technology"),
        make_holding("SBK.JO", 3000, "Financials"),
        make_holding("SOL.JO", 1500, "Energy"),
        make_holding("CLS.JO", 500, "Consumer"),
    ]




def test_weight_constants_sum_to_one():
    weights = [
        health_score.WEIGHT_SECTOR_CONCENTRATION,
        health_score.WEIGHT_SINGLE_POSITION,
        health_score.WEIGHT_BREADTH,
    ]
    assert sum(weights) == pytest.approx(1.0)


def test_hhi_calculation():
    # Worked example: 50% + 30% + 20%
    expected = 0.5**2 + 0.3**2 + 0.2**2
    assert health_score._hhi([0.5, 0.3, 0.2]) == pytest.approx(expected)


def test_empty_portfolio_returns_null_state():
    assert health_score.compute_health_score([]) == {
        "score": None,
        "label": None,
        "subscores": [],
    }


def test_single_asset_portfolio_penalties(make_holding):
    portfolio = [make_holding("NPN.JO", 10000, "Technology")]
    res = health_score.compute_health_score(portfolio)
    subscores = {s["key"]: s["value"] for s in res["subscores"]}

    assert subscores["sectorConcentration"] < 2.0
    assert subscores["singleStockRisk"] < 2.0
    assert subscores["portfolioBreadth"] < 3.0
    assert res["score"] < 2.0


def test_well_diversified_portfolio_scores_high(make_holding):
    sectors = ["Technology", "Financials", "Healthcare", "Industrials", "Consumer"]
    holdings = [
        make_holding(f"STOCK_{i}", 1000, sectors[i % len(sectors)])
        for i in range(10)
    ]
    
    res = health_score.compute_health_score(holdings)
    assert res["score"] >= 7.0


def test_top_heavy_portfolio_breadth_penalty(make_holding):
    holdings = [make_holding("BIG.JO", 8000, "Technology")]
    holdings.extend(
        make_holding(f"SMALL_{i}", 2000 / 19, "Financials") 
        for i in range(19)
    )

    res = health_score.compute_health_score(holdings)
    breadth = next(s for s in res["subscores"] if s["key"] == "portfolioBreadth")
    assert breadth["value"] < 3.0


def test_sector_normalization_handles_missing_data(make_holding):
    holdings = [
        make_holding("A.JO", 500, None),
        make_holding("B.JO", 500, "none"),
    ]
    assert health_score._sector_weights(holdings) == {"Other": 1.0}


def test_etf_lookthrough_labeling(make_holding):
    holdings = [
        make_holding("STX40.JO", 9000, "SA Equity", kind=KIND_ETF),
        make_holding("NPN.JO", 1000, "Technology"),
    ]
    res = health_score.compute_health_score(holdings)
    single_pos = next(s for s in res["subscores"] if s["key"] == "singleStockRisk")

    assert single_pos["label"] == "Fund Concentration"
    assert "look-through" in single_pos["detail"]


def test_conflicting_subscores_sector_vs_position_breadth(make_holding):
    # 10 stocks, highly spread out in value, but concentrated in a single sector
    holdings = [make_holding(f"TECH_{i}", 1000, "Technology") for i in range(10)]
    res = health_score.compute_health_score(holdings)
    subscores = {s["key"]: s["value"] for s in res["subscores"]}

    assert subscores["sectorConcentration"] < 3.0
    assert subscores["portfolioBreadth"] >= 9.0


def test_stale_pricing_warning_in_details(make_holding):
    holdings = [
        make_holding("NPN.JO", 5000, "Technology", priced_live=False),
        make_holding("SBK.JO", 5000, "Financials"),
    ]
    res = health_score.compute_health_score(holdings)
    sector_info = next(s for s in res["subscores"] if s["key"] == "sectorConcentration")
    assert "priced at cost" in sector_info["detail"]




def test_default_config_matches_equitylens_preset():
    preset = health_score.PRESETS[health_score.PRESET_EQUITYLENS]
    assert health_score.DEFAULT_CONFIG is preset.config


def test_omitting_config_uses_default(sample_portfolio):
    explicit = health_score.compute_health_score(sample_portfolio, health_score.DEFAULT_CONFIG)
    implicit = health_score.compute_health_score(sample_portfolio)
    assert explicit == implicit


def test_all_presets_are_valid():
    for name, preset in health_score.PRESETS.items():
        cfg = preset.config
        total = cfg.weight_sector_concentration + cfg.weight_single_position + cfg.weight_breadth
        assert total == pytest.approx(1.0), f"Preset '{name}' weights do not sum to 1.0"

        # Check serialization roundtrip
        marshaled = health_score.config_to_dict(cfg)
        assert health_score.config_from_dict(marshaled) == cfg


def test_strict_vs_loose_presets(sample_portfolio):
    strict_cfg = health_score.PRESETS["capital_preservation"].config
    loose_cfg = health_score.PRESETS["concentrated"].config

    strict_score = health_score.compute_health_score(sample_portfolio, strict_cfg)["score"]
    loose_score = health_score.compute_health_score(sample_portfolio, loose_cfg)["score"]

    assert loose_score > strict_score


def test_threshold_config_changes_narrative_output(make_holding):
    portfolio = [
        make_holding("NPN.JO", 3200, "Technology"),
        make_holding("SBK.JO", 2500, "Financials"),
        make_holding("SOL.JO", 2300, "Energy"),
        make_holding("CLS.JO", 2000, "Consumer"),
    ]

    def get_risk_detail(config):
        res = health_score.compute_health_score(portfolio, config)
        return next(s for s in res["subscores"] if s["key"] == "singleStockRisk")["detail"]

    strict_detail = get_risk_detail(health_score.PRESETS["capital_preservation"].config)
    loose_detail = get_risk_detail(health_score.PRESETS["concentrated"].config)

    assert "High concentration" in strict_detail
    assert "Low concentration" in loose_detail
    assert "32% of your book" in strict_detail
    assert "32% of your book" in loose_detail


def test_subscore_weights_match_active_config(sample_portfolio):
    growth_cfg = health_score.PRESETS["growth"].config
    res = health_score.compute_health_score(sample_portfolio, growth_cfg)
    weights = {s["key"]: s["weight"] for s in res["subscores"]}

    assert weights["portfolioBreadth"] == pytest.approx(0.40)
    assert weights["sectorConcentration"] == pytest.approx(0.30)


def test_subscore_targets_reflect_config(sample_portfolio):
    cfg = health_score.PRESETS["capital_preservation"].config
    res = health_score.compute_health_score(sample_portfolio, cfg)
    subscores = {s["key"]: s for s in res["subscores"]}

    assert subscores["portfolioBreadth"]["target"] == "12+ effective positions"
    assert subscores["singleStockRisk"]["target"] == "Under 15% in any one holding"
    assert "8+ evenly-weighted sectors" in subscores["sectorConcentration"]["target"]


def test_partial_config_fallback_behavior():
    cfg = health_score.config_from_dict({"breadth_target_n": 15})
    assert cfg.breadth_target_n == 15
    assert cfg.concentration_low == health_score.DEFAULT_CONFIG.concentration_low


def test_partial_config_overrides_given_base():
    base_cfg = health_score.PRESETS["growth"].config
    cfg = health_score.config_from_dict({"breadth_target_n": 5}, base=base_cfg)

    assert cfg.breadth_target_n == 5
    assert cfg.hhi_well_spread == base_cfg.hhi_well_spread


def test_unknown_preset_falls_back_gracefully():
    assert health_score.preset_config("invalid_name") is health_score.DEFAULT_CONFIG
    assert health_score.preset_config(None) is health_score.DEFAULT_CONFIG


def test_matching_preset_detection():
    growth_cfg = health_score.PRESETS["growth"].config
    assert health_score.matching_preset_key(growth_cfg) == "growth"

    modified_cfg = health_score.config_from_dict({"breadth_target_n": 7}, base=growth_cfg)
    assert health_score.matching_preset_key(modified_cfg) is None


def test_presets_payload_structure():
    payload = health_score.presets_payload()
    
    assert [p["key"] for p in payload] == list(health_score.PRESETS)
    for entry in payload:
        assert entry["name"]
        assert entry["description"]
        assert set(entry["config"]) == set(health_score.CONFIG_FIELDS)



@pytest.mark.parametrize(
    ("invalid_config", "error_pattern"),
    [
        (
            {"weight_breadth": 0.3, "weight_sector_concentration": 0.3, "weight_single_position": 0.3},
            "sum to 1.0",
        ),
        ({"weight_breadth": 0.9}, "weight_breadth must be between"),
        (
            {"weight_breadth": 0.85, "weight_sector_concentration": 0.1, "weight_single_position": 0.05},
            "weight_breadth must be between",
        ),
        (
            {"weight_breadth": 0.01, "weight_sector_concentration": 0.49, "weight_single_position": 0.5},
            "weight_breadth must be between",
        ),
        ({"concentration_low": 50, "concentration_high": 40}, "must be below"),
        ({"concentration_high": 90}, "concentration_high must be between"),
        ({"hhi_well_spread": 0.8}, "hhi_well_spread must be between"),
        ({"breadth_target_n": 1}, "breadth_target_n must be between"),
        ({"breadth_target_n": 40}, "breadth_target_n must be between"),
        ({"breadth_target_n": "eight"}, "must be a number"),
        ({"breadth_target_n": float("nan")}, "finite"),
        ({"colour": "orange"}, "unknown config field"),
    ],
)
def test_config_guard_rails(invalid_config, error_pattern):
    with pytest.raises(ValueError, match=error_pattern):
        health_score.config_from_dict(invalid_config)