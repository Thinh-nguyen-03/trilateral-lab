import pytest
from fastapi.testclient import TestClient

from api.main import app
from src.strategies.manual import ManualStrategy
from src.types import SearchState


def test_manual_strategy_raises_when_called_directly():
    s = ManualStrategy()
    state = SearchState(week=1, measurement_mode="EXACT")
    with pytest.raises(RuntimeError):
        s.choose_location(state)


def test_manual_strategy_registered_in_registry():
    from src.evaluator import _build_registry
    registry = _build_registry()
    assert "manual" in registry
    assert registry["manual"]().__class__ is ManualStrategy


def test_manual_session_requires_location_in_step():
    client = TestClient(app)
    r = client.post(
        "/api/session/start",
        json={
            "strategy": "manual",
            "measurement_mode": "EXACT",
            "box_location": {"lat": 37.5, "lon": -96.0},
        },
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]

    # No location → 400
    r = client.post(f"/api/session/{sid}/step", json={})
    assert r.status_code == 400

    # Cleanup
    client.delete(f"/api/session/{sid}")


def test_manual_session_uses_supplied_location():
    client = TestClient(app)
    r = client.post(
        "/api/session/start",
        json={
            "strategy": "manual",
            "measurement_mode": "EXACT",
            "box_location": {"lat": 40.0, "lon": -100.0},
        },
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]

    picked = {"lat": 32.0, "lon": -110.0}
    r = client.post(f"/api/session/{sid}/step", json={"location": picked})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["week"] == 1
    assert data["chosen_location"]["lat"] == pytest.approx(picked["lat"])
    assert data["chosen_location"]["lon"] == pytest.approx(picked["lon"])
    # observed distance should be a positive number
    assert data["observed_distance"] > 0

    client.delete(f"/api/session/{sid}")


def test_non_manual_session_ignores_supplied_location():
    client = TestClient(app)
    r = client.post(
        "/api/session/start",
        json={
            "strategy": "fixed",
            "measurement_mode": "EXACT",
            "box_location": {"lat": 40.0, "lon": -100.0},
        },
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]

    # Supplying location with a non-manual strategy must not error; strategy picks own
    r = client.post(f"/api/session/{sid}/step", json={"location": {"lat": 99.0, "lon": 99.0}})
    assert r.status_code == 200, r.text
    # The fixed strategy picks Seattle first (~47.6, -122.3)
    loc = r.json()["chosen_location"]
    assert loc["lat"] != 99.0

    client.delete(f"/api/session/{sid}")
