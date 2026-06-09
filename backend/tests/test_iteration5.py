"""Iteration 5 backend tests: validation, status flows, deletion, hall-of-fame, deadlines."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cup-companion-3.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "gabriella.bengtsson2@gmail.com"
ADMIN_PASS = "WorldCup2026!"

DEFAULT_V1 = "2026-06-11T18:55:00+00:00"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    yield s
    # Restore V1 deadline
    s.post(f"{API}/config/v1-deadline", json={"deadline": DEFAULT_V1})


@pytest.fixture(scope="module")
def teams_by_group(admin_session):
    r = admin_session.get(f"{API}/teams/groups", timeout=15)
    assert r.status_code == 200
    return r.json()


# =========== Regression =============
def test_health_login():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200
    assert "token" in r.json()


def test_matches_count():
    r = requests.get(f"{API}/matches", timeout=15)
    assert r.status_code == 200
    matches = r.json()
    assert len(matches) >= 104, f"Expected >=104 matches, got {len(matches)}"


def test_teams_count():
    r = requests.get(f"{API}/teams", timeout=15)
    assert r.status_code == 200
    assert len(r.json()) == 48


def test_leaderboard():
    r = requests.get(f"{API}/leaderboard", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


# =========== Group rankings validation =============
def test_tp_rejects_fewer_than_4(admin_session, teams_by_group):
    group_a = teams_by_group["A"]
    payload = {"version": 2, "group_rankings": {"A": [group_a[0]["id"], group_a[1]["id"], group_a[2]["id"]]}}
    # First make sure V2 has no past deadline
    admin_session.post(f"{API}/config/v2-deadline", json={"deadline": "2099-01-01T00:00:00+00:00"})
    r = admin_session.post(f"{API}/tournament-predictions", json=payload, timeout=15)
    assert r.status_code == 400
    assert "exakt 4 lag" in r.json()["detail"]


def test_tp_rejects_empty_placement(admin_session, teams_by_group):
    group_a = teams_by_group["A"]
    payload = {"version": 2, "group_rankings": {"A": [group_a[0]["id"], group_a[1]["id"], group_a[2]["id"], ""]}}
    r = admin_session.post(f"{API}/tournament-predictions", json=payload, timeout=15)
    assert r.status_code == 400
    assert "alla fyra platser" in r.json()["detail"]


def test_tp_rejects_duplicates(admin_session, teams_by_group):
    group_a = teams_by_group["A"]
    payload = {"version": 2, "group_rankings": {"A": [group_a[0]["id"], group_a[0]["id"], group_a[1]["id"], group_a[2]["id"]]}}
    r = admin_session.post(f"{API}/tournament-predictions", json=payload, timeout=15)
    assert r.status_code == 400
    assert "varje lag får bara väljas en gång" in r.json()["detail"]


def test_tp_rejects_team_not_in_group(admin_session, teams_by_group):
    group_a = teams_by_group["A"]
    group_b = teams_by_group["B"]
    # Replace one of group A's IDs with one from B
    payload = {"version": 2, "group_rankings": {"A": [group_a[0]["id"], group_a[1]["id"], group_a[2]["id"], group_b[0]["id"]]}}
    r = admin_session.post(f"{API}/tournament-predictions", json=payload, timeout=15)
    assert r.status_code == 400
    assert "tillhör inte gruppen" in r.json()["detail"]


def test_tp_valid_payload_accepted(admin_session, teams_by_group):
    rankings = {g: [t["id"] for t in teams[:4]] for g, teams in teams_by_group.items() if len(teams) >= 4}
    payload = {"version": 2, "group_rankings": rankings}
    r = admin_session.post(f"{API}/tournament-predictions", json=payload, timeout=15)
    assert r.status_code == 200, f"Expected 200, got {r.status_code} {r.text}"


# =========== Locked version =============
def test_tp_v2_locked_after_deadline(admin_session, teams_by_group):
    # Set V2 deadline to the past
    admin_session.post(f"{API}/config/v2-deadline", json={"deadline": "2020-01-01T00:00:00+00:00"})
    rankings = {g: [t["id"] for t in teams[:4]] for g, teams in teams_by_group.items() if len(teams) >= 4}
    payload = {"version": 2, "group_rankings": rankings}
    r = admin_session.post(f"{API}/tournament-predictions", json=payload, timeout=15)
    assert r.status_code == 400
    assert "Version 2 är låst" in r.json()["detail"]
    # Restore for other tests
    admin_session.post(f"{API}/config/v2-deadline", json={"deadline": "2099-01-01T00:00:00+00:00"})


# =========== Deadlines config =============
def test_deadlines_all(admin_session):
    r = admin_session.get(f"{API}/config/deadlines", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ("1", "2", "3", "4"):
        assert k in data


def test_set_v2_deadline_reflects(admin_session):
    target = "2030-05-15T12:00:00+00:00"
    r = admin_session.post(f"{API}/config/v2-deadline", json={"deadline": target}, timeout=15)
    assert r.status_code == 200
    r2 = admin_session.get(f"{API}/config/deadlines", timeout=15)
    assert r2.json()["2"].startswith("2030-05-15T12:00:00")


# =========== User status flow =============
@pytest.fixture(scope="module")
def test_user(admin_session):
    """Create a fresh test user via invite + register."""
    email = f"TEST_iter5_status_{int(time.time())}@example.com"
    pw = "TestPass123!"
    # Invite
    admin_session.post(f"{API}/admin/invite", json={"email": email})
    # Register
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"name": "Iter5 Status", "email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.text}"
    user_id = r.json()["user"]["id"]
    yield {"id": user_id, "email": email, "password": pw}
    # Cleanup
    admin_session.request("DELETE", f"{API}/admin/users/{user_id}", json={"confirmation": "DELETE"})


def test_deactivate_user_blocks_login(admin_session, test_user):
    r = admin_session.put(f"{API}/admin/users/{test_user['id']}/status", json={"status": "deactivated"})
    assert r.status_code == 200
    # Try login
    r2 = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=15)
    assert r2.status_code == 403
    assert "avaktiverat" in r2.json()["detail"]


def test_reactivate_user(admin_session, test_user):
    r = admin_session.put(f"{API}/admin/users/{test_user['id']}/status", json={"status": "active"})
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=15)
    assert r2.status_code == 200


def test_ban_requires_reason(admin_session, test_user):
    r = admin_session.put(f"{API}/admin/users/{test_user['id']}/status", json={"status": "banned"})
    assert r.status_code == 400
    assert "Anledning krävs" in r.json()["detail"]


def test_ban_with_reason_and_me_blocked(admin_session, test_user):
    r = admin_session.put(f"{API}/admin/users/{test_user['id']}/status", json={"status": "banned", "reason": "Testreason"})
    assert r.status_code == 200
    # Login should fail
    r2 = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=15)
    assert r2.status_code == 403


def test_unban_restores(admin_session, test_user):
    r = admin_session.post(f"{API}/admin/users/{test_user['id']}/unban")
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=15)
    assert r2.status_code == 200


def test_audit_log_status_changes(admin_session):
    r = admin_session.get(f"{API}/admin/audit-log?limit=50")
    assert r.status_code == 200
    logs = r.json()
    actions = [(l.get("action"), l.get("details", {})) for l in logs]
    actions_only = [a[0] for a in actions]
    assert any(a in ("user_deactivated", "user_activated", "user_banned", "user_unbanned") for a in actions_only)
    # Verify old_value/new_value present in status entries
    status_entries = [d for a, d in actions if a in ("user_deactivated", "user_banned", "user_activated", "user_unbanned")]
    assert any("old_value" in d and "new_value" in d for d in status_entries)


# =========== User deletion =============
def test_delete_wrong_confirmation(admin_session):
    # Create transient user
    email = f"TEST_iter5_del_{int(time.time())}@example.com"
    admin_session.post(f"{API}/admin/invite", json={"email": email})
    s = requests.Session()
    rr = s.post(f"{API}/auth/register", json={"name": "Del", "email": email, "password": "TestPass123!"})
    assert rr.status_code == 200
    uid = rr.json()["user"]["id"]
    # Wrong confirmation
    r = admin_session.request("DELETE", f"{API}/admin/users/{uid}", json={"confirmation": "WRONG"})
    assert r.status_code == 400
    # Cleanup
    admin_session.request("DELETE", f"{API}/admin/users/{uid}", json={"confirmation": "DELETE"})


def test_delete_correct_confirmation(admin_session):
    email = f"TEST_iter5_del2_{int(time.time())}@example.com"
    admin_session.post(f"{API}/admin/invite", json={"email": email})
    s = requests.Session()
    rr = s.post(f"{API}/auth/register", json={"name": "Del2", "email": email, "password": "TestPass123!"})
    assert rr.status_code == 200
    uid = rr.json()["user"]["id"]
    r = admin_session.request("DELETE", f"{API}/admin/users/{uid}", json={"confirmation": "DELETE", "reason": "cleanup"})
    assert r.status_code == 200
    # Verify gone
    users_r = admin_session.get(f"{API}/admin/users")
    assert not any(u["id"] == uid for u in users_r.json())


def test_cannot_delete_primary_admin(admin_session):
    users = admin_session.get(f"{API}/admin/users").json()
    admin_user = next(u for u in users if u["email"] == ADMIN_EMAIL)
    r = admin_session.request("DELETE", f"{API}/admin/users/{admin_user['id']}", json={"confirmation": "DELETE"})
    assert r.status_code == 400
    assert "primära administrat" in r.json()["detail"]


# =========== Leaderboard filtering =============
def test_leaderboard_only_active(admin_session):
    # Create a user, deactivate them, ensure not in leaderboard
    email = f"TEST_iter5_lb_{int(time.time())}@example.com"
    admin_session.post(f"{API}/admin/invite", json={"email": email})
    s = requests.Session()
    rr = s.post(f"{API}/auth/register", json={"name": "LBHidden", "email": email, "password": "TestPass123!"})
    uid = rr.json()["user"]["id"]
    # Confirm initially on leaderboard
    lb_before = requests.get(f"{API}/leaderboard").json()
    assert any(r["user_id"] == uid for r in lb_before)
    # Deactivate
    admin_session.put(f"{API}/admin/users/{uid}/status", json={"status": "deactivated"})
    lb_after = requests.get(f"{API}/leaderboard").json()
    assert not any(r["user_id"] == uid for r in lb_after)
    # Cleanup
    admin_session.request("DELETE", f"{API}/admin/users/{uid}", json={"confirmation": "DELETE"})


# =========== Hall of Fame =============
def test_hof_crud(admin_session):
    # Cleanup if exists
    admin_session.delete(f"{API}/hall-of-fame/2022")
    # Initially: may or may not be empty, but 2022 should not exist
    r = requests.get(f"{API}/hall-of-fame")
    assert r.status_code == 200
    assert not any(row["year"] == 2022 for row in r.json())
    # Create
    payload = {"year": 2022, "winner_name": "A", "winner_points": 100,
               "second_name": "B", "second_points": 80, "third_name": "C", "third_points": 60}
    r = admin_session.post(f"{API}/hall-of-fame", json=payload)
    assert r.status_code == 200, r.text
    # Get
    r2 = requests.get(f"{API}/hall-of-fame").json()
    assert any(row["year"] == 2022 and row["winner_name"] == "A" for row in r2)
    # Duplicate
    r3 = admin_session.post(f"{API}/hall-of-fame", json=payload)
    assert r3.status_code == 400
    # Delete
    r4 = admin_session.delete(f"{API}/hall-of-fame/2022")
    assert r4.status_code == 200
    r5 = requests.get(f"{API}/hall-of-fame").json()
    assert not any(row["year"] == 2022 for row in r5)
