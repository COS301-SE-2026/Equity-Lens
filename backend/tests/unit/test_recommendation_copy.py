import pytest

from app.services.recommendation_copy import CLOSE_GAP, _closest_traits, describe_similar

DEFAULT_GAPS = {"size": 0.12, "free float": 0.81, "dividend yield": 0.34}


@pytest.fixture
def sample_recommendation():
    return {
        "closeness": 0.824,
        "similar_to": "CPI",
        "gaps": DEFAULT_GAPS,
    }


class TestClosestTraitsResolution:
    def test_threshold_boundary_included_as_trait_match(self):
        gaps = {"size": CLOSE_GAP, "free float": 2.0, "dividend yield": 2.0}
        assert _closest_traits(gaps) == "size"

    def test_gap_exceeding_threshold_falls_back_to_overall_profile(self):
        gaps = {"size": CLOSE_GAP + 0.001, "free float": 2.0, "dividend yield": 2.0}
        assert _closest_traits(gaps) == "overall profile"

    def test_limits_trait_naming_to_top_two_ordered_by_proximity(self):
        gaps = {"size": 0.3, "free float": 0.1, "dividend yield": 0.2}
        assert _closest_traits(gaps) == "free float and dividend yield"


class TestDescribeSimilarFormatting:
    def test_intra_sector_match_description_formatting(self, sample_recommendation):
        description = describe_similar(
            sample_recommendation,
            source_sector="Financial Services",
            target_sector="Financial Services",
        )
        expected = (
            "82% match to CPI: same sector (Financial Services), similar size and dividend yield"
        )
        assert description == expected

    def test_cross_sector_match_description_formatting(self, sample_recommendation):
        description = describe_similar(
            sample_recommendation,
            source_sector="Financial Services",
            target_sector="Basic Materials",
        )
        expected = (
            "82% match to CPI: similar size and dividend yield "
            "despite a different sector (Basic Materials)"
        )
        assert description == expected