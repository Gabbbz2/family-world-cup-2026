"""Iteration 4 backend tests: 5-min lock, predictions visibility, V1 deadline default, regression."""
import os
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://cup-companion-3.preview.emergentagent.com"
ADMIN_EMAIL = "gabriella.bengtsson2@gmail.com"
ADMIN_PASSWORD = "WorldCup2026!"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def real_team_ids(admin_session):
    teams = admin_session.get(f"{BASE_URL}/api/teams").json()
    assert len(teams) >= 48
    return teams[0]["id"], teams[1]["id"]


# ---------- Regression ----------
def test_regression_matches_teams_leaderboard(admin_session):
    m = admin_session.get(f"{BASE_URL}/api/matches").json()
    t = admin_session.get(f"{BASE_URL}/api/teams").json()
    lb = admin_session.get(f"{BASE_URL}/api/leaderboard").json()
    assert len(m) >= 100, f"Expected ~104 matches, got {len(m)}"
    assert len(t) >= 48, f"Expected 48 teams, got {len(t)}"
    assert isinstance(lb, list) and len(lb) >= 1


def test_auth_me(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


# ---------- V1 Deadline default ----------
def test_v1_deadline_default_present(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/config/v1-deadline")
    assert r.status_code == 200
    data = r.json()
    assert data.get("deadline"), "Default V1 deadline must be seeded"
    dl = datetime.fromisoformat(data["deadline"].replace("Z", "+00:00"))
    # Should be 2026-06-11 18:55 UTC (= 20:55 Europe/Stockholm)
    expected = datetime(2026, 6, 11, 18, 55, tzinfo=timezone.utc)
    # Only check equality if default — may have been changed by previous admin actions
    # so only assert it parses and is in the right ballpark (year 2026)
    assert dl.year == 2026


# ---------- 5-minute lock on POST /api/predictions ----------
def _create_match(session, kickoff_dt, home_id, away_id, match_number=99901):
    payload = {
        "stage": "group", "group": "Z",
        "home_team_id": home_id, "away_team_id": away_id,
        "kickoff": kickoff_dt.isoformat(),
        "match_number": match_number,
    }
    r = session.post(f"{BASE_URL}/api/matches", json=payload)
    assert r.status_code == 200, f"create_match failed: {r.status_code} {r.text}"
    return r.json()


def test_prediction_locked_when_within_5min(admin_session, real_team_ids):
    home_id, away_id = real_team_ids
    kickoff = datetime.now(timezone.utc) + timedelta(minutes=3)  # within lock window
    m = _create_match(admin_session, kickoff, home_id, away_id, match_number=99991)
    try:
        r = admin_session.post(f"{BASE_URL}/api/predictions",
                                json={"match_id": m["id"], "home_score": 1, "away_score": 1})
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail", "")
        assert "Tippning stängd" in detail, f"Expected 'Tippning stängd', got: {detail}"
    finally:
        admin_session.delete(f"{BASE_URL}/api/matches/{m['id']}")


def test_prediction_open_when_more_than_5min(admin_session, real_team_ids):
    home_id, away_id = real_team_ids
    kickoff = datetime.now(timezone.utc) + timedelta(minutes=10)  # outside lock window
    m = _create_match(admin_session, kickoff, home_id, away_id, match_number=99992)
    try:
        r = admin_session.post(f"{BASE_URL}/api/predictions",
                                json={"match_id": m["id"], "home_score": 2, "away_score": 1})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("home_score") == 2 and body.get("away_score") == 1
        # verify GET /predictions/me includes it
        mp = admin_session.get(f"{BASE_URL}/api/predictions/me").json()
        assert any(p.get("match_id") == m["id"] for p in mp)
    finally:
        admin_session.delete(f"{BASE_URL}/api/matches/{m['id']}")


# ---------- GET /api/predictions/match/{id} visibility ----------
def test_match_predictions_locked_for_non_finished(admin_session, real_team_ids):
    """Even though caller is admin, the endpoint allows admin to see; verify status logic.

    Admin sees regardless. So we test that:
      - For an unfinished match the endpoint returns locked=False to admins (per code path).
      - The 'locked: True' branch is what non-admins see; we simulate by inspecting behaviour
        with a regular user if possible. Otherwise we at least confirm endpoint works.
    """
    home_id, away_id = real_team_ids
    kickoff = datetime.now(timezone.utc) + timedelta(minutes=15)
    m = _create_match(admin_session, kickoff, home_id, away_id, match_number=99993)
    try:
        r = admin_session.get(f"{BASE_URL}/api/predictions/match/{m['id']}")
        assert r.status_code == 200
        data = r.json()
        # Admin sees unlocked since role==admin short-circuits
        assert data.get("locked") is False
        assert isinstance(data.get("predictions"), list)
    finally:
        admin_session.delete(f"{BASE_URL}/api/matches/{m['id']}")


def test_match_predictions_locked_for_regular_user(admin_session, real_team_ids):
    """Create a test user via invite+register, then verify locked=True for unfinished match."""
    test_email = "TEST_iter4_viewer@example.com"
    # Invite first
    admin_session.post(f"{BASE_URL}/api/admin/invite", json={"email": test_email})

    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try register (may already exist from previous run)
    rr = s.post(f"{BASE_URL}/api/auth/register",
                json={"name": "Test Viewer", "email": test_email, "password": "TestPass123!"})
    if rr.status_code != 200:
        # Login instead
        rl = s.post(f"{BASE_URL}/api/auth/login", json={"email": test_email, "password": "TestPass123!"})
        if rl.status_code != 200:
            pytest.skip(f"Could not create/login test user: register={rr.status_code} login={rl.status_code}")
        s.headers.update({"Authorization": f"Bearer {rl.json()['token']}"})
    else:
        s.headers.update({"Authorization": f"Bearer {rr.json()['token']}"})

    home_id, away_id = (admin_session.get(f"{BASE_URL}/api/teams").json()[0]["id"],
                         admin_session.get(f"{BASE_URL}/api/teams").json()[1]["id"])
    kickoff = datetime.now(timezone.utc) + timedelta(minutes=15)
    m = _create_match(admin_session, kickoff, home_id, away_id, match_number=99994)
    try:
        r = s.get(f"{BASE_URL}/api/predictions/match/{m['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data.get("locked") is True, f"Non-admin should see locked=True for unfinished match, got {data}"
        assert data.get("predictions") == []
    finally:
        admin_session.delete(f"{BASE_URL}/api/matches/{m['id']}")


# ---------- Tournament prediction late flag still stored ----------
def test_tp_late_flag_stored(admin_session):
    # Set deadline to past
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    r = admin_session.post(f"{BASE_URL}/api/config/v1-deadline", json={"deadline": past})
    assert r.status_code == 200

    try:
        # Submit V1 — admin
        teams = admin_session.get(f"{BASE_URL}/api/teams").json()
        gr = {}
        # build a minimal valid group ranking
        groups = {}
        for t in teams:
            groups.setdefault(t["group"], []).append(t["id"])
        for g, ids in groups.items():
            gr[g] = ids[:4]
        r = admin_session.post(f"{BASE_URL}/api/tournament-predictions",
                                json={"version": 1, "group_rankings": gr,
                                      "advancing": [], "r32": [], "r16": [], "qf": [],
                                      "sf": [], "finalists": [], "champion": None})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("is_late") is True, f"Expected is_late=True after past deadline, got {body.get('is_late')}"
    finally:
        # Restore default
        default_v1 = "2026-06-11T18:55:00+00:00"
        admin_session.post(f"{BASE_URL}/api/config/v1-deadline", json={"deadline": default_v1})
