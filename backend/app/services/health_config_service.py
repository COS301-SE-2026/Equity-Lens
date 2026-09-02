from dataclasses import dataclass
from datetime import date

from app.repositories.goal_repository import GoalRepository
from app.repositories.user_preference_repository import UserPreferenceRepository
from app.services import health_score
from app.services.health_score import HealthConfig

SOURCE_CUSTOM = "custom"
SOURCE_PRESET = "preset"
SOURCE_DERIVED = "derived"
SOURCE_DEFAULT = "default"

NEAR_TERM_YEARS = 10
MID_TERM_YEARS = 20
SHORT_WEALTH_YEARS = 5


@dataclass(frozen=True)
class ResolvedHealthConfig:
    config: HealthConfig
    source: str
    preset_key: str | None


def _years_to(target_date) -> float | None:
    if target_date is None:
        return None
    return max(0.0, (target_date - date.today()).days / 365.25)


def derive_preset_key(goal) -> str | None:
    if goal is None:
        return None

    years = _years_to(getattr(goal, "target_date", None))
    if years is None:
        return None

    if goal.goal_type == "retirement":
        if years <= NEAR_TERM_YEARS:
            return "capital_preservation"
        if years <= MID_TERM_YEARS:
            return "balanced"
        return "growth"

    if goal.goal_type == "wealth_accumulation":
        return "balanced" if years <= SHORT_WEALTH_YEARS else "growth"

    return None


def resolve_health_config(db, user_id) -> ResolvedHealthConfig:
    preference = UserPreferenceRepository(db).get(user_id)

    if preference is not None and preference.health_config:
        try:
            config = health_score.config_from_dict(preference.health_config)
        except ValueError:
            pass
        else:
            return ResolvedHealthConfig(
                config=config,
                source=SOURCE_CUSTOM,
                preset_key=health_score.matching_preset_key(config),
            )

    if preference is not None and preference.health_preset_key:
        key = preference.health_preset_key
        if key in health_score.PRESETS:
            return ResolvedHealthConfig(
                config=health_score.preset_config(key), source=SOURCE_PRESET, preset_key=key
            )

    derived = derive_preset_key(GoalRepository(db).get_latest(user_id))
    if derived:
        return ResolvedHealthConfig(
            config=health_score.preset_config(derived), source=SOURCE_DERIVED, preset_key=derived
        )

    return ResolvedHealthConfig(
        config=health_score.DEFAULT_CONFIG,
        source=SOURCE_DEFAULT,
        preset_key=health_score.PRESET_EQUITYLENS,
    )


def health_config_payload(db, user_id) -> dict:
    resolved = resolve_health_config(db, user_id)
    derived = derive_preset_key(GoalRepository(db).get_latest(user_id))

    return {
        "active": health_score.config_to_dict(resolved.config),
        "source": resolved.source,
        "preset_key": resolved.preset_key,
        "derived_preset_key": derived,
        "default_preset_key": health_score.PRESET_EQUITYLENS,
        "presets": health_score.presets_payload(),
        "bounds": {
            "weight_min": health_score.WEIGHT_MIN,
            "weight_max": health_score.WEIGHT_MAX,
            "concentration_pct_min": health_score.CONCENTRATION_PCT_MIN,
            "concentration_pct_max": health_score.CONCENTRATION_PCT_MAX,
            "hhi_target_min": health_score.HHI_TARGET_MIN,
            "hhi_target_max": health_score.HHI_TARGET_MAX,
            "breadth_target_min": health_score.BREADTH_TARGET_MIN,
            "breadth_target_max": health_score.BREADTH_TARGET_MAX,
        },
    }


def save_health_config(
    db, user_id, preset_key: str | None = None, config: dict | None = None
) -> dict:
    if (preset_key is None) == (config is None):
        raise ValueError("pass exactly one of preset_key or config")

    if preset_key is not None:
        if preset_key not in health_score.PRESETS:
            raise ValueError(f"unknown preset: {preset_key}")
        fields = {"health_preset_key": preset_key, "health_config": None}
    else:
        validated = health_score.config_from_dict(config)
        matching = health_score.matching_preset_key(validated)
        fields = (
            {"health_preset_key": matching, "health_config": None}
            if matching
            else {
                "health_preset_key": None,
                "health_config": health_score.config_to_dict(validated),
            }
        )

    UserPreferenceRepository(db).upsert(user_id, **fields)
    db.commit()
    return health_config_payload(db, user_id)


def clear_health_config(db, user_id) -> dict:
    UserPreferenceRepository(db).upsert(user_id, health_preset_key=None, health_config=None)
    db.commit()
    return health_config_payload(db, user_id)
