import pytest

from app.services import health_score


@pytest.mark.parametrize("key", sorted(health_score.PRESETS))
def test_every_preset_survives_its_own_validator(key):
    config = health_score.PRESETS[key].config
    assert health_score.config_from_dict(health_score.config_to_dict(config)) == config


@pytest.mark.parametrize("key", sorted(health_score.PRESETS))
def test_preset_key_matches_its_dict_key(key):
    assert health_score.PRESETS[key].key == key


def test_presets_payload_carries_the_numbers_the_ui_renders():
    payload = {p["key"]: p for p in health_score.presets_payload()}
    assert set(payload) == set(health_score.PRESETS)
    for key, entry in payload.items():
        assert entry["description"].strip()
        assert set(entry["config"]) == set(health_score.CONFIG_FIELDS)
        assert entry["config"] == health_score.config_to_dict(health_score.PRESETS[key].config)


def test_institutional_does_not_claim_to_check_the_40_percent_limb():
    description = health_score.PRESETS["institutional"].description
    assert "not checked" in description
    assert "compliance" in description
