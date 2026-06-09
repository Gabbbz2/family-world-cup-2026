"""Iteration 2 tests: vm2026.xlsx auto-import, standings, tournament progression,
group_rankings predictions with uniqueness, v1-deadline config, team DQ/reinstate,
admin audit-log, Excel import preview/commit."""
import os
import uuid
import requests
from datetime import datetime, timezone, timedelta

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url().rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "gabriella.bengtsson2@gmail.com"
ADMIN_PASS = "WorldCup2026!"
XLSX = "/app/backend/data/vm2026.xlsx"

_s = {}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_00_admin_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    _s["admin"] = r.json()["token"]


def test_01_teams_48_swedish_names():
    r = requests.get(f"{API}/teams")
    assert r.status_code == 200
    teams = r.json()
    assert len(teams) == 48, f"expected 48 got {len(teams)}"
    names = {t["team_name"] for t in teams}
    # Swedish names expected from real xlsx
    expected_any = {"Mexiko", "Sydafrika", "Tjeckien", "Brasilien", "Argentina"}
    overlap = names & expected_any
    assert overlap, f"None of {expected_any} found. Sample: {list(names)[:10]}"
    groups = {t.get("group") for t in teams}
    assert groups == set("ABCDEFGHIJKL"), groups
    _s["teams"] = teams


def test_02_matches_104_with_metadata():
    r = requests.get(f"{API}/matches")
    assert r.status_code == 200
    matches = r.json()
    assert len(matches) == 104, f"expected 104 got {len(matches)}"
    # Has match_number, round, tv_channel
    with_mn = [m for m in matches if m.get("match_number")]
    assert len(with_mn) >= 100
    with_tv = [m for m in matches if m.get("tv_channel")]
    assert len(with_tv) >= 50, f"only {len(with_tv)} matches with tv_channel"
    rounds = {m.get("round") for m in matches if m.get("round")}
    assert any("Omg" in (r or "") for r in rounds), f"rounds: {rounds}"
    # Placeholders present on knockouts
    ph = [m for m in matches if m.get("home_placeholder") or m.get("away_placeholder")]
    assert len(ph) >= 16, f"expected knockout placeholders, got {len(ph)}"
    _s["matches"] = matches


def test_03_standings_12_groups():
    r = requests.get(f"{API}/standings")
    assert r.status_code == 200
    st = r.json()
    assert set(st.keys()) == set("ABCDEFGHIJKL"), st.keys()
    for g, rows in st.items():
        assert len(rows) == 4, f"group {g} has {len(rows)}"
        for row in rows:
            for k in ("played", "won", "drawn", "lost", "goals_for", "goals_against", "goal_diff", "points"):
                assert k in row


def test_04_tournament_prediction_group_rankings_uniqueness():
    # Invite + register a fresh user
    email = f"test_iter2_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/admin/invite", json={"email": email}, headers=_h(_s["admin"]))
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/register", json={"name": "I2", "email": email, "password": "pass1234"})
    assert r2.status_code == 200
    _s["user"] = r2.json()["token"]
    _s["user_id"] = r2.json()["user"]["id"]

    teams = _s["teams"]
    group_a = [t for t in teams if t["group"] == "A"][:4]
    assert len(group_a) == 4
    ids = [t["id"] for t in group_a]
    # Valid ranking
    payload = {"version": 1, "group_rankings": {"A": ids}}
    r3 = requests.post(f"{API}/tournament-predictions", json=payload, headers=_h(_s["user"]))
    assert r3.status_code == 200, r3.text
    assert "is_late" in r3.json()

    # Duplicate -> 400
    bad = {"version": 1, "group_rankings": {"A": [ids[0], ids[0], ids[1], ids[2]]}}
    r4 = requests.post(f"{API}/tournament-predictions", json=bad, headers=_h(_s["user"]))
    assert r4.status_code == 400, r4.text


def test_05_v1_deadline_get_set_and_late_flag():
    # Set future deadline
    future = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    r = requests.post(f"{API}/config/v1-deadline", json={"deadline": future}, headers=_h(_s["admin"]))
    assert r.status_code == 200
    g = requests.get(f"{API}/config/v1-deadline").json()
    assert g["deadline"]

    # Submit a v1 - should NOT be late
    teams = _s["teams"]
    ids = [t["id"] for t in teams if t["group"] == "B"][:4]
    payload = {"version": 1, "group_rankings": {"B": ids}}
    r2 = requests.post(f"{API}/tournament-predictions", json=payload, headers=_h(_s["user"]))
    assert r2.json().get("is_late") is False

    # Set past deadline -> is_late=True
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    r3 = requests.post(f"{API}/config/v1-deadline", json={"deadline": past}, headers=_h(_s["admin"]))
    assert r3.status_code == 200
    payload2 = {"version": 1, "group_rankings": {"C": [t["id"] for t in teams if t["group"] == "C"][:4]}}
    r4 = requests.post(f"{API}/tournament-predictions", json=payload2, headers=_h(_s["user"]))
    assert r4.json().get("is_late") is True

    # Restore future deadline
    requests.post(f"{API}/config/v1-deadline", json={"deadline": future}, headers=_h(_s["admin"]))


def test_06_team_disqualify_and_reinstate():
    teams = _s["teams"]
    tid = teams[0]["id"]
    # No reason -> 400
    r = requests.post(f"{API}/admin/teams/disqualify", json={"team_id": tid, "reason": ""}, headers=_h(_s["admin"]))
    assert r.status_code == 400
    # Disqualify
    r2 = requests.post(f"{API}/admin/teams/disqualify",
                      json={"team_id": tid, "reason": "Testing DQ"}, headers=_h(_s["admin"]))
    assert r2.status_code == 200
    # Verify team flagged
    all_teams = requests.get(f"{API}/teams").json()
    dq = next(t for t in all_teams if t["id"] == tid)
    assert dq.get("disqualified") is True
    assert dq.get("disqualified_reason") == "Testing DQ"
    # Reinstate
    r3 = requests.post(f"{API}/admin/teams/{tid}/reinstate", headers=_h(_s["admin"]))
    assert r3.status_code == 200
    all_teams2 = requests.get(f"{API}/teams").json()
    rt = next(t for t in all_teams2 if t["id"] == tid)
    assert not rt.get("disqualified")


def test_07_audit_log_has_entries():
    r = requests.get(f"{API}/admin/audit-log", headers=_h(_s["admin"]))
    assert r.status_code == 200
    logs = r.json()
    assert len(logs) > 0
    actions = {l["action"] for l in logs}
    # Should include at least these from prior tests
    expected = {"team_disqualify", "team_reinstate", "v1_deadline_set"}
    assert expected.issubset(actions), f"missing {expected - actions} in {actions}"


def test_08_import_preview():
    with open(XLSX, "rb") as f:
        files = {"file": ("vm2026.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/admin/import-preview", files=files, headers=_h(_s["admin"]))
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["summary"]
    assert s["teams_count"] == 48, s
    assert s["matches_count"] == 104, s
    assert set(s["groups_detected"]) == set("ABCDEFGHIJKL")


def test_09_progression_W_placeholder_resolution():
    """Manually populate match #73 home/away, set its result, ensure downstream
    matches referencing W73 get home_team_id/away_team_id assigned."""
    matches = requests.get(f"{API}/matches").json()
    m73 = next((m for m in matches if m.get("match_number") == 73), None)
    if not m73:
        # Skip if dataset doesn't have match 73 (unlikely)
        return
    teams = _s["teams"]
    th, ta = teams[0]["id"], teams[1]["id"]
    # Force home/away via manual-advance
    requests.post(f"{API}/admin/manual-advance",
                  json={"match_id": m73["id"], "team_id": th, "side": "home"}, headers=_h(_s["admin"]))
    requests.post(f"{API}/admin/manual-advance",
                  json={"match_id": m73["id"], "team_id": ta, "side": "away"}, headers=_h(_s["admin"]))
    # Set result so winner=th
    rr = requests.put(f"{API}/matches/{m73['id']}/result",
                      json={"home_score": 2, "away_score": 1}, headers=_h(_s["admin"]))
    assert rr.status_code == 200
    # Call progress explicitly
    requests.post(f"{API}/admin/progress", headers=_h(_s["admin"]))
    after = requests.get(f"{API}/matches").json()
    # Find any downstream match where placeholder was W73
    ref = [m for m in after if m.get("home_placeholder") == "W73" or m.get("away_placeholder") == "W73"]
    if ref:
        # That match should now have the corresponding team_id populated
        downstream = ref[0]
        if downstream.get("home_placeholder") == "W73":
            assert downstream.get("home_team_id") == th, f"expected {th}, got {downstream.get('home_team_id')}"
        if downstream.get("away_placeholder") == "W73":
            assert downstream.get("away_team_id") == th
    # Cleanup: clear result on m73
    requests.delete(f"{API}/matches/{m73['id']}/result", headers=_h(_s["admin"]))


def test_99_cleanup():
    if _s.get("user_id"):
        requests.delete(f"{API}/admin/users/{_s['user_id']}", headers=_h(_s["admin"]))
