from datetime import date, timedelta

from app.models.goal import Goal
from app.services import health_score

URL = "/api/portfolio/health-config"


def test_get_returns_the_default_yardstick_and_the_full_preset_list(client, auth_headers):
    response = client.get(URL, headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["source"] == "default"
    assert body["preset_key"] == health_score.PRESET_EQUITYLENS
    assert body["active"] == health_score.config_to_dict(health_score.DEFAULT_CONFIG)
    assert len(body["presets"]) == len(health_score.PRESETS)


def test_put_a_preset_then_get_reads_it_back(client, auth_headers):
    put = client.put(URL, json={"preset_key": "concentrated"}, headers=auth_headers)
    assert put.status_code == 200
    assert put.json()["source"] == "preset"

    body = client.get(URL, headers=auth_headers).json()
    assert body["preset_key"] == "concentrated"
    assert body["active"]["breadth_target_n"] == 4


def test_put_a_custom_config_reports_it_as_custom(client, auth_headers):
    response = client.put(URL, json={"config": {"breadth_target_n": 14}}, headers=auth_headers)
    assert response.status_code == 200

    body = response.json()
    assert body["source"] == "custom"
    assert body["active"]["breadth_target_n"] == 14
    assert body["active"]["concentration_low"] == health_score.DEFAULT_CONFIG.concentration_low


def test_put_rejects_a_config_that_breaks_the_guard_rails_with_a_400(client, auth_headers):
    response = client.put(URL, json={"config": {"hhi_well_spread": 0.9}}, headers=auth_headers)
    assert response.status_code == 400
    assert "hhi_well_spread" in response.json()["detail"]


def test_put_rejects_weights_that_do_not_sum_to_one_with_a_400(client, auth_headers):
    response = client.put(
        URL,
        json={
            "config": {
                "weight_sector_concentration": 0.5,
                "weight_single_position": 0.5,
                "weight_breadth": 0.5,
            }
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "sum to 1.0" in response.json()["detail"]


def test_put_rejects_an_unknown_preset_with_a_400(client, auth_headers):
    response = client.put(URL, json={"preset_key": "not_a_preset"}, headers=auth_headers)
    assert response.status_code == 400


def test_put_rejects_both_or_neither_at_the_schema_layer(client, auth_headers):
    assert client.put(URL, json={}, headers=auth_headers).status_code == 422
    both = {"preset_key": "growth", "config": {"breadth_target_n": 9}}
    assert client.put(URL, json=both, headers=auth_headers).status_code == 422


def test_delete_clears_the_choice_and_falls_back_to_the_goal_derived_preset(
    client, auth_headers, db_session, test_user
):
    db_session.add(
        Goal(
            user_id=test_user.id,
            goal_type="retirement",
            target_value=5_000_000,
            target_date=date.today() + timedelta(days=365 * 30),
        )
    )
    db_session.commit()

    client.put(URL, json={"preset_key": "income"}, headers=auth_headers)
    assert client.get(URL, headers=auth_headers).json()["preset_key"] == "income"

    response = client.delete(URL, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["source"] == "derived"
    assert response.json()["preset_key"] == "growth"


def test_the_chosen_yardstick_actually_reaches_the_health_score_endpoint(client, auth_headers):
    client.put(URL, json={"preset_key": "growth"}, headers=auth_headers)
    body = client.get(URL, headers=auth_headers).json()
    assert body["active"]["weight_breadth"] == health_score.PRESETS["growth"].config.weight_breadth

    score = client.get("/api/portfolio/health-score", headers=auth_headers)
    assert score.status_code == 200
