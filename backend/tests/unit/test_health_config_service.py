from datetime import date, timedelta

import pytest

from app.models.goal import Goal
from app.models.user_preference import UserPreference
from app.services import health_config_service as svc
from app.services import health_score


def _add_goal(db_session, user, goal_type, years):
    goal = Goal(
        user_id=user.id,
        goal_type=goal_type,
        target_value=1_000_000,
        target_date=date.today() + timedelta(days=round(years * 365.25)),
        target_years=round(years) if goal_type == "wealth_accumulation" else None,
    )
    db_session.add(goal)
    db_session.commit()
    return goal

@pytest.mark.parametrize(
    ("goal_type", "years", "expected"),
    [
        ("retirement", 3, "capital_preservation"),
        ("retirement", 10, "capital_preservation"),
        ("retirement", 15, "balanced"),
        ("retirement", 30, "growth"),
        ("wealth_accumulation", 2, "balanced"),
        ("wealth_accumulation", 12, "growth"),
    ],
)
def test_goal_horizon_derives_a_preset(db_session, test_user, goal_type, years, expected):
    _add_goal(db_session, test_user, goal_type, years)
    resolved = svc.resolve_health_config(db_session, test_user.id)
    assert resolved.preset_key == expected
    assert resolved.source == svc.SOURCE_DERIVED


def test_no_goal_falls_back_to_the_equitylens_default(db_session, test_user):
    resolved = svc.resolve_health_config(db_session, test_user.id)
    assert resolved.source == svc.SOURCE_DEFAULT
    assert resolved.config is health_score.DEFAULT_CONFIG


def test_an_unrecognised_goal_type_derives_nothing_rather_than_guessing(db_session, test_user):
    _add_goal(db_session, test_user, "buy_a_boat", 7)
    resolved = svc.resolve_health_config(db_session, test_user.id)
    assert resolved.source == svc.SOURCE_DEFAULT


def test_a_derived_preset_is_never_written_back_as_the_users_own_choice(
    db_session, test_user
):
    goal = _add_goal(db_session, test_user, "retirement", 30)
    assert svc.resolve_health_config(db_session, test_user.id).preset_key == "growth"
    assert db_session.query(UserPreference).count() == 0

    goal.target_date = date.today() + timedelta(days=5 * 365)
    db_session.commit()
    assert svc.resolve_health_config(db_session, test_user.id).preset_key == "capital_preservation"


def test_a_chosen_preset_outranks_the_one_derived_from_the_goal(db_session, test_user):
    _add_goal(db_session, test_user, "retirement", 30)
    svc.save_health_config(db_session, test_user.id, preset_key="income")

    resolved = svc.resolve_health_config(db_session, test_user.id)
    assert resolved.preset_key == "income"
    assert resolved.source == svc.SOURCE_PRESET


def test_a_custom_config_outranks_a_previously_chosen_preset(db_session, test_user):
    svc.save_health_config(db_session, test_user.id, preset_key="income")
    svc.save_health_config(db_session, test_user.id, config={"breadth_target_n": 17})

    resolved = svc.resolve_health_config(db_session, test_user.id)
    assert resolved.source == svc.SOURCE_CUSTOM
    assert resolved.config.breadth_target_n == 17
    assert resolved.preset_key is None

    stored = db_session.query(UserPreference).one()
    assert stored.health_preset_key is None


def test_a_custom_config_that_matches_a_preset_is_stored_as_that_preset(db_session, test_user):
    growth = health_score.config_to_dict(health_score.PRESETS["growth"].config)
    svc.save_health_config(db_session, test_user.id, config=growth)
    stored = db_session.query(UserPreference).one()
    assert stored.health_preset_key == "growth"
    assert stored.health_config is None
    assert svc.resolve_health_config(db_session, test_user.id).source == svc.SOURCE_PRESET


def test_clearing_returns_to_the_goal_derived_preset_without_deleting_the_row(
    db_session, test_user
):
    _add_goal(db_session, test_user, "retirement", 30)
    svc.save_health_config(db_session, test_user.id, preset_key="income")

    payload = svc.clear_health_config(db_session, test_user.id)
    assert payload["source"] == svc.SOURCE_DERIVED
    assert payload["preset_key"] == "growth"
    assert db_session.query(UserPreference).count() == 1


def test_saving_requires_exactly_one_of_preset_or_config(db_session, test_user):
    with pytest.raises(ValueError, match="exactly one"):
        svc.save_health_config(db_session, test_user.id)
    with pytest.raises(ValueError, match="exactly one"):
        svc.save_health_config(
            db_session, test_user.id, preset_key="growth", config={"breadth_target_n": 9}
        )


def test_saving_an_unknown_preset_is_rejected(db_session, test_user):
    with pytest.raises(ValueError, match="unknown preset"):
        svc.save_health_config(db_session, test_user.id, preset_key="yolo")


def test_an_out_of_bounds_custom_config_is_rejected_before_it_is_stored(db_session, test_user):
    with pytest.raises(ValueError, match="breadth_target_n must be between"):
        svc.save_health_config(db_session, test_user.id, config={"breadth_target_n": 99})
    assert db_session.query(UserPreference).count() == 0


def test_a_stored_config_that_no_longer_validates_falls_through_instead_of_raising(
    db_session, test_user
):
    stale = {"breadth_target_n": 99, "weight_breadth": 0.25}
    db_session.add(UserPreference(user_id=test_user.id, health_config=stale))
    db_session.commit()

    resolved = svc.resolve_health_config(db_session, test_user.id)
    assert resolved.source == svc.SOURCE_DEFAULT


def test_a_stored_preset_key_that_no_longer_exists_falls_through(db_session, test_user):
    db_session.add(UserPreference(user_id=test_user.id, health_preset_key="preset_we_removed"))
    db_session.commit()
    assert svc.resolve_health_config(db_session, test_user.id).source == svc.SOURCE_DEFAULT

def test_payload_names_the_derived_alternative_so_a_reset_can_be_labelled(db_session, test_user):
    _add_goal(db_session, test_user, "retirement", 30)
    svc.save_health_config(db_session, test_user.id, preset_key="income")

    payload = svc.health_config_payload(db_session, test_user.id)
    assert payload["preset_key"] == "income"
    assert payload["derived_preset_key"] == "growth"
    assert payload["default_preset_key"] == health_score.PRESET_EQUITYLENS
    assert [p["key"] for p in payload["presets"]] == list(health_score.PRESETS)
    assert payload["bounds"]["weight_max"] == health_score.WEIGHT_MAX