import dataclasses

import numpy as np
import pytest

from app.services import exposure_engine as ee
from app.services.exposure_engine import Feature, NormalizedFeature


@pytest.fixture
def make_feature():
    def _factory(
        ticker: str,
        market_cap: float,
        float_pct: float,
        yield_pct: float,
        sector: str = "Financial Services",
    ) -> Feature:
        return Feature(
            ticker=ticker,
            name=ticker,
            sector=sector,
            market_cap=market_cap,
            local_float_pct=float_pct,
            dividend_yield=yield_pct,
        )

    return _factory


@pytest.fixture
def make_norm():
    def _factory(
        ticker: str,
        z_mcap: float,
        z_float: float,
        z_yield: float,
        sector: str = "Financial Services",
    ) -> NormalizedFeature:
        return NormalizedFeature(
            ticker=ticker,
            sector=sector,
            z_log_mcap=z_mcap,
            z_local_float=z_float,
            z_div_yield=z_yield,
        )

    return _factory


@pytest.fixture
def reference_universe(make_feature):
    return [
        make_feature("AAA", 20, 60, 2.0),
        make_feature("BBB", 80, 75, 4.0),
        make_feature("CCC", 150, 85, 5.5),
        make_feature("DDD", 400, 95, 7.0),
        make_feature("EEE", 900, 100, 3.0),
    ]


class TestFeatureDataModel:
    def test_instance_immutability(self, make_feature):
        feature = make_feature("CPI", 518.55, 75.35, 1.78)
        with pytest.raises(dataclasses.FrozenInstanceError):
            feature.dividend_yield = 2.0

    def test_positional_argument_initialization(self):
        feature = Feature("CPI", "Capitec", "Financial Services", 518.55, 75.35, 1.78)
        assert feature.ticker == "CPI"


class TestUniverseNormalization:
    def test_reference_dataset_standardization(self, reference_universe):
        normalized = ee.normalize_universe(reference_universe)
        
        for attribute in ("z_log_mcap", "z_local_float", "z_div_yield"):
            metric_values = np.array([getattr(item, attribute) for item in normalized])
            assert metric_values.mean() == pytest.approx(0, abs=1e-9)
            assert metric_values.std() == pytest.approx(1, abs=1e-9)

    def test_holding_preserves_reference_scale(self, make_feature, reference_universe):
        outlier_stock = make_feature("XYZ", 1.5, 10, 0.5)
        standalone_norm = ee.normalize_universe(reference_universe)
        combined_norm = ee.normalize_universe(
            reference_universe + [outlier_stock],
            reference=reference_universe,
        )

        for base, relative in zip(standalone_norm, combined_norm[: len(reference_universe)]):
            assert relative.z_log_mcap == pytest.approx(base.z_log_mcap)
            assert relative.z_local_float == pytest.approx(base.z_local_float)
            assert relative.z_div_yield == pytest.approx(base.z_div_yield)

    def test_empty_reference_fallback_behavior(self, reference_universe):
        standard = ee.normalize_universe(reference_universe)
        fallback = ee.normalize_universe(reference_universe, reference=[])
        
        assert [item.z_local_float for item in fallback] == pytest.approx(
            [item.z_local_float for item in standard]
        )

    def test_zero_variance_field_handling(self, make_feature, reference_universe):
        constant_float_features = [
            make_feature(item.ticker, item.market_cap, 80, item.dividend_yield)
            for item in reference_universe
        ]
        normalized = ee.normalize_universe(constant_float_features)
        
        assert all(item.z_local_float == 0 for item in normalized)

    def test_logarithmic_market_cap_scaling(self, make_feature):
        dataset = [
            make_feature("A", 10, 80, 3),
            make_feature("B", 100, 80, 3),
            make_feature("C", 1000, 80, 3),
        ]
        normalized = ee.normalize_universe(dataset)
        
        first_step = normalized[1].z_log_mcap - normalized[0].z_log_mcap
        second_step = normalized[2].z_log_mcap - normalized[1].z_log_mcap
        
        assert first_step == pytest.approx(second_step)

    def test_dividend_yield_cap_clamping(self, make_feature, reference_universe):
        dataset = reference_universe + [
            make_feature("CAP", 100, 80, ee.YIELD_CAP),
            make_feature("SPECIAL", 100, 80, ee.YIELD_CAP + 10),
        ]
        results = {item.ticker: item for item in ee.normalize_universe(dataset)}
        
        assert results["CAP"].z_div_yield == pytest.approx(results["SPECIAL"].z_div_yield)


class TestDistanceCalculation:
    def test_identical_intra_sector_stocks_zero_distance(self, make_norm):
        stock_a = make_norm("A", 1, 2, 3)
        stock_b = make_norm("B", 1, 2, 3)
        
        assert ee._distance(stock_a, stock_b) == 0

    def test_cross_sector_mismatch_penalty(self, make_norm):
        finance_stock = make_norm("A", 1, 2, 3, sector="Financial Services")
        materials_stock = make_norm("B", 1, 2, 3, sector="Basic Materials")
        
        assert ee._distance(finance_stock, materials_stock) == pytest.approx(
            ee.SECTOR_MISMATCH_PENALTY
        )

    def test_euclidean_distance_accuracy(self, make_norm):
        origin_stock = make_norm("A", 0, 0, 0)
        offset_stock = make_norm("B", 0.3, 0.088, 0.294)
        
        assert ee._distance(origin_stock, offset_stock) == pytest.approx(0.429, abs=1e-3)


class TestGapMetrics:
    def test_gaps_symmetry_and_absolute_values(self, make_norm):
        stock_a = make_norm("A", 1.0, -0.5, 0.2)
        stock_b = make_norm("B", 0.4, 0.5, 0.9)

        assert ee._gaps(stock_a, stock_b) == ee._gaps(stock_b, stock_a)
        assert ee._gaps(stock_a, stock_b) == {
            "size": 0.6,
            "free float": 1.0,
            "dividend yield": 0.7,
        }


class TestSimilarityScoringEngine:
    @pytest.fixture
    def scoring_context(self, make_norm):
        holding = make_norm("HLD", 0, 0, 0)
        universe = [
            holding,
            make_norm("NEAR", 0.1, 0, 0),
            make_norm("MID", 1.0, 0, 0),
            make_norm("FAR", 3.0, 0, 0),
            make_norm("SAME", 0, 0, 0),
        ]
        return holding, universe

    def test_holding_self_exclusion(self, scoring_context):
        holding, universe = scoring_context
        results = ee.similarity_scores(holding, universe, k=10)
        
        assert "HLD" not in [item["ticker"] for item in results]

    def test_distance_ordering(self, scoring_context):
        holding, universe = scoring_context
        results = ee.similarity_scores(holding, universe, k=10)
        distances = [item["distance"] for item in results]
        
        assert distances == sorted(distances)

    def test_result_limit_constraint(self, scoring_context):
        holding, universe = scoring_context
        assert len(ee.similarity_scores(holding, universe, k=2)) == 2

    def test_result_structure_and_keys(self, scoring_context):
        holding, universe = scoring_context
        top_match = ee.similarity_scores(holding, universe, k=1)[0]
        
        assert top_match["similar_to"] == "HLD"
        assert set(top_match["gaps"]) == {"size", "free float", "dividend yield"}

    def test_perfect_match_closeness_score(self, scoring_context):
        holding, universe = scoring_context
        results = {
            item["ticker"]: item
            for item in ee.similarity_scores(holding, universe, k=10)
        }
        
        assert results["SAME"]["closeness"] == 1.0

    def test_relative_closeness_scaling(self, scoring_context):
        holding, universe = scoring_context
        results = {
            item["ticker"]: item
            for item in ee.similarity_scores(holding, universe, k=10)
        }
        expected = 1 - 0.1 / ee.RANDOM_PAIR_DISTANCE
        
        assert results["NEAR"]["closeness"] == pytest.approx(expected, abs=1e-3)

    test_outlier_closeness_lower_bound = lambda self, scoring_context: (
        assert_closeness_zero(scoring_context)
    )


def assert_closeness_zero(scoring_context):
    holding, universe = scoring_context
    results = {
        item["ticker"]: item
        for item in ee.similarity_scores(holding, universe, k=10)
    }
    assert results["FAR"]["closeness"] == 0.0