"""Iteration 6 backend tests: 7 strategy versions, knockout picks, admin overrides, recompute."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cup-companion-3.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "gabriella.bengtsson2@gmail.com"
ADMIN_PASS = "WorldCup2026!"

EXPECTED_VERSIONS = [
    ("pre_tournament", "Första Tipset", 72, "2026-06-11T18:55"),
    ("r32", "Tips Sextondelsfinal", 16, "2026-06-28T18:55"),
    ("r16", "Tips Åttondelsfinal", 8, "2026-07-04T16:55"),
    ("qf", "Tips Kvartsfinal", 4, "2026-07-09T19:55"),
    ("sf", "Tips Semifinal", 2, "2026-07-14T18:55"),
    ("third_place", "Tips Bronsmatch", 1, "2026-07-18T20:55"),
    ("final", "Tips Final", 1, "2026-07-19T18:55"),
]


# ============== Fixtures ==============
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    yield s
    # Cleanup: reset all overrides to auto
    for vid, *_ in EXPECTED_VERSIONS:
        s.post(f"{API}/admin/strategy/version/{vid}/override", json={"status": "auto", "custom_deadline": None})


@pytest.fixture(scope="module")
def viewer_user(admin_session):
    """Create a viewer user that is NOT admin."""
    email = f"TEST_iter6_viewer_{int(time.time())}@example.com"
    pw = "TestPass123!"
    admin_session.post(f"{API}/admin/invite", json={"email": email})
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"name": "Iter6 Viewer", "email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    uid = r.json()["user"]["id"]
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    yield {"id": uid, "email": email, "password": pw, "session": s}
    admin_session.request("DELETE", f"{API}/admin/users/{uid}", json={"confirmation": "DELETE"})


@pytest.fixture(scope="module")
def picker_user(admin_session):
    """A second non-admin who submits picks."""
    email = f"TEST_iter6_picker_{int(time.time())}@example.com"
    pw = "TestPass123!"
    admin_session.post(f"{API}/admin/invite", json={"email": email})
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"name": "Iter6 Picker", "email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    uid = r.json()["user"]["id"]
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    yield {"id": uid, "email": email, "password": pw, "session": s}
    admin_session.request("DELETE", f"{API}/admin/users/{uid}", json={"confirmation": "DELETE"})


@pytest.fixture(scope="module")
def teams_by_group(admin_session):
    r = admin_session.get(f"{API}/teams/groups", timeout=15)
    return r.json()


# ============== Versions listing ==============
def test_strategy_versions_order_and_defaults(admin_session):
    r = admin_session.get(f"{API}/strategy/versions", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 7, f"Expected 7 versions, got {len(data)}"
    for i, (vid, label, match_count, deadline_prefix) in enumerate(EXPECTED_VERSIONS):
        v = data[i]
        assert v["id"] == vid, f"Order mismatch at {i}: {v['id']} vs {vid}"
        assert v["label"] == label
        assert v["match_count"] == match_count, f"{vid}: expected {match_count} matches, got {v['match_count']}"
        assert v.get("default_deadline"), f"{vid}: missing default_deadline"
        assert v["default_deadline"].startswith(deadline_prefix), \
            f"{vid}: deadline {v['default_deadline']} doesn't start with {deadline_prefix}"


# ============== r32 matches endpoint ==============
def test_r32_matches_list(admin_session):
    r = admin_session.get(f"{API}/strategy/version/r32/matches", timeout=15)
    assert r.status_code == 200
    matches = r.json()
    assert len(matches) == 16
    for m in matches:
        assert m["stage"] == "Knockout"
        assert (m.get("round") or "").lower().startswith("sextondelsfinal"), f"Bad round: {m.get('round')}"


def test_unknown_version_returns_404(admin_session):
    r = admin_session.get(f"{API}/strategy/version/bogus/matches")
    assert r.status_code == 404


# ============== pre_tournament submission ==============
def test_pre_tournament_valid_submission(picker_user, teams_by_group):
    rankings = {g: [t["id"] for t in teams[:4]] for g, teams in teams_by_group.items() if len(teams) >= 4}
    payload = {"group_rankings": rankings, "advancing": [], "r32": [], "r16": [],
               "qf": [], "sf": [], "finalists": [], "champion": None}
    r = picker_user["session"].post(f"{API}/strategy/version/pre_tournament", json=payload, timeout=15)
    assert r.status_code == 200, r.text


def test_pre_tournament_rejects_duplicate(picker_user, teams_by_group):
    group_a = teams_by_group["A"]
    rankings = {"A": [group_a[0]["id"], group_a[0]["id"], group_a[1]["id"], group_a[2]["id"]]}
    r = picker_user["session"].post(f"{API}/strategy/version/pre_tournament", json={"group_rankings": rankings})
    assert r.status_code == 400
    assert "varje lag" in r.json()["detail"]


def test_pre_tournament_rejects_wrong_group(picker_user, teams_by_group):
    group_a = teams_by_group["A"]
    group_b = teams_by_group["B"]
    rankings = {"A": [group_a[0]["id"], group_a[1]["id"], group_a[2]["id"], group_b[0]["id"]]}
    r = picker_user["session"].post(f"{API}/strategy/version/pre_tournament", json={"group_rankings": rankings})
    assert r.status_code == 400
    assert "tillhör inte gruppen" in r.json()["detail"]


# ============== r32 winner picks ==============
def test_r32_pick_invalid_match_id(picker_user, teams_by_group):
    some_team = teams_by_group["A"][0]["id"]
    r = picker_user["session"].post(
        f"{API}/strategy/version/r32",
        json={"picks": {"NOT_A_MATCH_ID": some_team}},
    )
    assert r.status_code == 400
    assert "ingår inte i denna version" in r.json()["detail"]


def test_r32_pick_invalid_team_for_match(admin_session, picker_user, teams_by_group):
    # Find a r32 match with both home_team_id and away_team_id present (#73 is one)
    matches = admin_session.get(f"{API}/strategy/version/r32/matches").json()
    target = next((m for m in matches if m.get("home_team_id") and m.get("away_team_id")), None)
    if not target:
        pytest.skip("No r32 match with both teams populated")
    # Pick a team that isn't home/away
    home, away = target["home_team_id"], target["away_team_id"]
    other = next(t["id"] for g in teams_by_group.values() for t in g if t["id"] not in (home, away))
    r = picker_user["session"].post(
        f"{API}/strategy/version/r32",
        json={"picks": {target["id"]: other}},
    )
    assert r.status_code == 400
    assert "Vinnaren måste vara" in r.json()["detail"]


def test_r32_valid_pick_accepted(admin_session, picker_user):
    matches = admin_session.get(f"{API}/strategy/version/r32/matches").json()
    target = next((m for m in matches if m.get("home_team_id") and m.get("away_team_id")), None)
    if not target:
        pytest.skip("No r32 match with both teams populated")
    r = picker_user["session"].post(
        f"{API}/strategy/version/r32",
        json={"picks": {target["id"]: target["home_team_id"]}},
    )
    assert r.status_code == 200, r.text
    assert r.json()["picks"][target["id"]] == target["home_team_id"]


# ============== Override + locked submission ==============
def test_override_closed_blocks_submission(admin_session, picker_user):
    r = admin_session.post(f"{API}/admin/strategy/version/r32/override", json={"status": "closed"})
    assert r.status_code == 200
    r2 = picker_user["session"].post(f"{API}/strategy/version/r32", json={"picks": {}})
    assert r2.status_code == 400
    assert "Tippning stängd" in r2.json()["detail"]
    # restore
    admin_session.post(f"{API}/admin/strategy/version/r32/override", json={"status": "auto"})


# ============== Predictions visibility ==============
def test_predictions_hidden_pre_deadline(viewer_user):
    # Ensure r16 is in auto mode (deadline in future)
    r = viewer_user["session"].get(f"{API}/strategy/version/r16/predictions")
    assert r.status_code == 200
    data = r.json()
    assert data["locked"] is True
    assert data["predictions"] == []


def test_predictions_visible_after_closed_override(admin_session, picker_user, viewer_user):
    # Make sure picker submitted something for r16
    matches = admin_session.get(f"{API}/strategy/version/r16/matches").json()
    if matches:
        # Just submit empty picks dict (still creates record)
        picker_user["session"].post(f"{API}/strategy/version/r16", json={"picks": {}})
    # Admin closes r16
    admin_session.post(f"{API}/admin/strategy/version/r16/override", json={"status": "closed"})
    try:
        r = viewer_user["session"].get(f"{API}/strategy/version/r16/predictions")
        assert r.status_code == 200
        data = r.json()
        assert data["locked"] is False
        # Picker's submission should be present with user_name
        mine = [d for d in data["predictions"] if d["user_id"] == picker_user["id"]]
        assert len(mine) >= 1
        assert mine[0]["user_name"]
    finally:
        admin_session.post(f"{API}/admin/strategy/version/r16/override", json={"status": "auto"})


# ============== Override audit log ==============
def test_override_audit_log(admin_session):
    admin_session.post(f"{API}/admin/strategy/version/qf/override", json={"status": "open"})
    admin_session.post(f"{API}/admin/strategy/version/qf/override", json={"status": "auto"})
    logs = admin_session.get(f"{API}/admin/audit-log?limit=20").json()
    overrides = [l for l in logs if l.get("action") == "strategy_version_override"]
    assert overrides, "No strategy_version_override audit entries"
    latest = overrides[0]
    assert "old_value" in latest["details"]
    assert "new_value" in latest["details"]
    assert latest["details"]["version_id"] == "qf"


# ============== Open override forces unlocked ==============
def test_override_open_forces_unlock(admin_session, picker_user):
    # Set r32 to past custom_deadline then force open
    admin_session.post(f"{API}/admin/strategy/version/r32/override",
                       json={"status": "open", "custom_deadline": "2020-01-01T00:00:00+00:00"})
    try:
        r = admin_session.get(f"{API}/strategy/versions").json()
        r32_state = next(v for v in r if v["id"] == "r32")
        assert r32_state["locked"] is False
        # Submit should pass
        r2 = picker_user["session"].post(f"{API}/strategy/version/r32", json={"picks": {}})
        assert r2.status_code == 200
    finally:
        admin_session.post(f"{API}/admin/strategy/version/r32/override",
                           json={"status": "auto", "custom_deadline": None})


# ============== Recompute endpoint ==============
def test_recompute_endpoint(admin_session):
    r = admin_session.post(f"{API}/admin/strategy/recompute")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ============== Regression ==============
def test_regression_matches_104(admin_session):
    r = requests.get(f"{API}/matches", timeout=15)
    assert r.status_code == 200
    assert len(r.json()) >= 104


def test_regression_teams_48(admin_session):
    r = requests.get(f"{API}/teams", timeout=15)
    assert len(r.json()) == 48


def test_regression_leaderboard():
    r = requests.get(f"{API}/leaderboard", timeout=15)
    assert r.status_code == 200


def test_regression_predictions_endpoint(picker_user):
    r = picker_user["session"].get(f"{API}/predictions/me")
    assert r.status_code == 200
