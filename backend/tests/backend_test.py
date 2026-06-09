"""Backend tests for Family World Cup 2026 - covers auth, invites, teams, matches,
predictions, scoring, leaderboard, tournament predictions, admin endpoints."""
import os
import uuid
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cup-companion-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "gabriella.bengtsson2@gmail.com"
ADMIN_PASS = "WorldCup2026!"

_state = {}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
def test_admin_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == ADMIN_EMAIL
    assert isinstance(data["token"], str)
    _state["admin_token"] = data["token"]
    _state["admin_id"] = data["user"]["id"]


def test_auth_me():
    r = requests.get(f"{API}/auth/me", headers=_auth(_state["admin_token"]))
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_register_non_invited_403():
    email = f"TEST_uninvited_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": "X", "email": email, "password": "pass1234"})
    assert r.status_code == 403


def test_admin_invite_then_register():
    email = f"test_invited_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/admin/invite", json={"email": email}, headers=_auth(_state["admin_token"]))
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/register", json={"name": "Test User", "email": email, "password": "pass1234"})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["user"]["role"] == "user"
    _state["user_token"] = body["token"]
    _state["user_id"] = body["user"]["id"]
    _state["user_email"] = email


# ---------- Teams ----------
def test_teams_48():
    r = requests.get(f"{API}/teams")
    assert r.status_code == 200
    teams = r.json()
    assert len(teams) == 48
    assert all("team_name" in t and "country_code" in t for t in teams)


def test_team_groups_12():
    r = requests.get(f"{API}/teams/groups")
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) == 12
    assert set(groups.keys()) == set("ABCDEFGHIJKL")
    for g, ts in groups.items():
        assert len(ts) == 4


# ---------- Matches ----------
def test_matches_with_teams():
    r = requests.get(f"{API}/matches")
    assert r.status_code == 200
    matches = r.json()
    assert len(matches) > 0
    m = matches[0]
    assert m["home_team"] and m["away_team"]
    assert "team_name" in m["home_team"]
    _state["upcoming_match"] = m


def test_non_admin_create_match_forbidden():
    r = requests.post(f"{API}/matches", headers=_auth(_state["user_token"]),
                      json={"stage": "group", "group": "A",
                            "home_team_id": "x", "away_team_id": "y",
                            "kickoff": datetime.now(timezone.utc).isoformat()})
    assert r.status_code == 403


# ---------- Predictions ----------
def test_prediction_create_and_upsert():
    m = _state["upcoming_match"]
    r = requests.post(f"{API}/predictions", headers=_auth(_state["user_token"]),
                      json={"match_id": m["id"], "home_score": 1, "away_score": 0})
    assert r.status_code == 200, r.text
    # upsert
    r2 = requests.post(f"{API}/predictions", headers=_auth(_state["user_token"]),
                       json={"match_id": m["id"], "home_score": 2, "away_score": 2})
    assert r2.status_code == 200
    preds = requests.get(f"{API}/predictions/me", headers=_auth(_state["user_token"])).json()
    mine = [p for p in preds if p["match_id"] == m["id"]]
    assert len(mine) == 1
    assert mine[0]["home_score"] == 2 and mine[0]["away_score"] == 2


def test_prediction_locked_after_kickoff():
    # Create a past-kickoff match via admin
    teams = requests.get(f"{API}/teams").json()
    payload = {
        "stage": "group", "group": "A",
        "home_team_id": teams[0]["id"], "away_team_id": teams[1]["id"],
        "kickoff": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
    }
    r = requests.post(f"{API}/matches", json=payload, headers=_auth(_state["admin_token"]))
    assert r.status_code == 200, r.text
    past = r.json()
    _state["past_match_id"] = past["id"]
    r2 = requests.post(f"{API}/predictions", headers=_auth(_state["user_token"]),
                       json={"match_id": past["id"], "home_score": 1, "away_score": 0})
    assert r2.status_code == 400
    assert "locked" in r2.json().get("detail", "").lower()


# ---------- Scoring ----------
def test_scoring_exact_match_10pts():
    teams = requests.get(f"{API}/teams").json()
    # Create future match
    payload = {
        "stage": "group", "group": "B",
        "home_team_id": teams[4]["id"], "away_team_id": teams[5]["id"],
        "kickoff": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
    }
    r = requests.post(f"{API}/matches", json=payload, headers=_auth(_state["admin_token"]))
    mid = r.json()["id"]
    # Predict 3-1
    rp = requests.post(f"{API}/predictions", headers=_auth(_state["user_token"]),
                       json={"match_id": mid, "home_score": 3, "away_score": 1})
    assert rp.status_code == 200
    # Set result 3-1 (exact)
    rr = requests.put(f"{API}/matches/{mid}/result", headers=_auth(_state["admin_token"]),
                      json={"home_score": 3, "away_score": 1})
    assert rr.status_code == 200
    # Check leaderboard - user should have at least 10 pts
    lb = requests.get(f"{API}/leaderboard").json()
    me_row = next((r for r in lb if r["user_id"] == _state["user_id"]), None)
    assert me_row is not None
    assert me_row["live_points"] >= 10, f"Expected >=10 live points, got {me_row['live_points']}"
    # cleanup
    requests.delete(f"{API}/matches/{mid}", headers=_auth(_state["admin_token"]))


# ---------- Leaderboard ----------
def test_leaderboard_structure():
    r = requests.get(f"{API}/leaderboard")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 2
    for row in rows:
        assert {"live_points", "strategy_points", "total_points", "rank"}.issubset(row.keys())
    # Sorted desc by total
    totals = [r["total_points"] for r in rows]
    assert totals == sorted(totals, reverse=True)


# ---------- Tournament Predictions ----------
def test_tournament_prediction_upsert():
    payload = {
        "version": 1,
        "group_winners": {"A": "t1", "B": "t2"},
        "group_runners_up": {"A": "t3"},
        "r16": ["t1"], "qf": [], "sf": [], "finalists": ["t1", "t2"], "champion": "t1",
    }
    r = requests.post(f"{API}/tournament-predictions", json=payload, headers=_auth(_state["user_token"]))
    assert r.status_code == 200
    # upsert with new champion
    payload["champion"] = "t9"
    r2 = requests.post(f"{API}/tournament-predictions", json=payload, headers=_auth(_state["user_token"]))
    assert r2.status_code == 200
    mine = requests.get(f"{API}/tournament-predictions/me", headers=_auth(_state["user_token"])).json()
    v1 = [d for d in mine if d["version"] == 1]
    assert len(v1) == 1
    assert v1[0]["champion"] == "t9"

    # Version 2
    payload["version"] = 2
    r3 = requests.post(f"{API}/tournament-predictions", json=payload, headers=_auth(_state["user_token"]))
    assert r3.status_code == 200
    mine2 = requests.get(f"{API}/tournament-predictions/me", headers=_auth(_state["user_token"])).json()
    assert len({d["version"] for d in mine2}) >= 2


# ---------- Admin endpoints ----------
def test_admin_users_requires_admin():
    r = requests.get(f"{API}/admin/users", headers=_auth(_state["user_token"]))
    assert r.status_code == 403
    r2 = requests.get(f"{API}/admin/users", headers=_auth(_state["admin_token"]))
    assert r2.status_code == 200


def test_admin_invites_requires_admin():
    r = requests.get(f"{API}/admin/invites", headers=_auth(_state["user_token"]))
    assert r.status_code == 403
    r2 = requests.get(f"{API}/admin/invites", headers=_auth(_state["admin_token"]))
    assert r2.status_code == 200


def test_admin_toggle_role():
    r = requests.put(f"{API}/admin/users/{_state['user_id']}/role",
                     json={"role": "admin"}, headers=_auth(_state["admin_token"]))
    assert r.status_code == 200
    # revert
    r2 = requests.put(f"{API}/admin/users/{_state['user_id']}/role",
                      json={"role": "user"}, headers=_auth(_state["admin_token"]))
    assert r2.status_code == 200


def test_admin_strategy_points():
    r = requests.post(f"{API}/admin/strategy-points",
                      json={"user_id": _state["user_id"], "points": 25},
                      headers=_auth(_state["admin_token"]))
    assert r.status_code == 200
    lb = requests.get(f"{API}/leaderboard").json()
    me = next(r for r in lb if r["user_id"] == _state["user_id"])
    assert me["strategy_points"] == 25
    assert me["total_points"] == me["live_points"] + 25


# ---------- Cleanup ----------
def test_cleanup():
    if _state.get("past_match_id"):
        requests.delete(f"{API}/matches/{_state['past_match_id']}", headers=_auth(_state["admin_token"]))
    if _state.get("user_id"):
        requests.delete(f"{API}/admin/users/{_state['user_id']}", headers=_auth(_state["admin_token"]))
