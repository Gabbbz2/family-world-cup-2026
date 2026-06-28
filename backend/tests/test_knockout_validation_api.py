import asyncio
import os

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_db")

import server


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    async def to_list(self, _):
        return list(self._rows)


class _FakeCollection:
    def __init__(self, rows):
        self._rows = rows

    def find(self, *args, **kwargs):
        return _FakeCursor(self._rows)


class _FakeDb:
    def __init__(self):
        self.matches = _FakeCollection(
            [
                {
                    "id": "m74",
                    "stage": "Knockout",
                    "round": "sextondelsfinal",
                    "match_number": 74,
                    "home_placeholder": "1A",
                    "away_placeholder": "3EFGHIJKL",
                    "home_team_id": "T1",
                    "away_team_id": "T3",
                }
            ]
        )
        self.teams = _FakeCollection(
            [
                {"id": "T1", "team_name": "Team 1", "group": "A", "country_code": "A1"},
                {"id": "T2", "team_name": "Team 2", "group": "B", "country_code": "B2"},
                {"id": "T3", "team_name": "Team 3", "group": "E", "country_code": "E3"},
            ]
        )


def test_knockout_validation_endpoint_shape(monkeypatch):
    async def _mock_compute_all_standings():
        return {"A": [{"team_id": "T1"}, {"team_id": "T2"}]}

    async def _mock_get_manual_assignment_overrides():
        return {}

    monkeypatch.setattr(server, "db", _FakeDb())
    monkeypatch.setattr(server, "compute_all_standings", _mock_compute_all_standings)
    monkeypatch.setattr(server, "completed_groups_from_standings", lambda _s: {"A": True})
    monkeypatch.setattr(server, "best_thirds_from_standings", lambda _s, _g: [{"team_id": "T3", "group": "E"}] * 8)
    monkeypatch.setattr(server, "official_third_place_team_ids", lambda _rows: ["T3"] * 8)
    monkeypatch.setattr(server, "official_third_place_match_groups", lambda _groups: {74: "E"})
    monkeypatch.setattr(server, "get_manual_assignment_overrides", _mock_get_manual_assignment_overrides)
    monkeypatch.setattr(server, "resolve_knockout_placeholder_team_id", lambda *_args, **_kwargs: "T1")

    payload = asyncio.run(server.knockout_validation())
    assert "group_complete" in payload
    assert "qualified_winners" in payload
    assert "qualified_runners_up" in payload
    assert "best_thirds" in payload
    assert "third_place_match_order" in payload
    assert payload["third_place_match_order"] == [74, 77, 79, 80, 81, 82, 85, 87]
    assert "generated_r32_matches" in payload
    assert "duplicates" in payload
    assert "missing_slots" in payload
    assert "invalid_third_assignments" in payload
    assert "manual_overrides" in payload