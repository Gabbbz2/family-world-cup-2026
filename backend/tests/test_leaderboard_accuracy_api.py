import asyncio
import os

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_db")

import server


class _Cursor:
    def __init__(self, rows):
        self._rows = rows

    async def to_list(self, _):
        return list(self._rows)


class _Collection:
    def __init__(self, rows):
        self._rows = rows

    def find(self, *args, **kwargs):
        return _Cursor(self._rows)


class _FakeDb:
    def __init__(self):
        self.users = _Collection([
            {
                "id": "u1",
                "name": "Alice",
                "email": "alice@example.com",
                "role": "user",
                "status": "active",
                "live_points": 0,
                "strategy_points": 0,
            }
        ])
        self.matches = _Collection([
            {
                "id": "m1",
                "stage": "group",
                "status": "finished",
                "home_score": 2,
                "away_score": 1,
            }
        ])
        self.match_predictions = _Collection([
            {
                "user_id": "u1",
                "match_id": "m1",
                "home_score": 1,
                "away_score": 0,
            }
        ])
        self.teams = _Collection([
            {"id": "T1", "group": "A"},
            {"id": "T2", "group": "A"},
            {"id": "T3", "group": "A"},
            {"id": "T4", "group": "A"},
        ])
        self.tournament_predictions = _Collection([
            {
                "user_id": "u1",
                "version": "pre_tournament",
                "group_rankings": {"A": ["T1", "T2", "T3", "T4"]},
                "advancing": ["T1", "ZZZ"],
            }
        ])


def test_leaderboard_returns_normalized_accuracy_fields(monkeypatch):
    async def _standings():
        return {
            "A": [
                {"team_id": "T1", "played": 3, "points": 7, "goal_diff": 4, "goals_for": 6},
                {"team_id": "T2", "played": 3, "points": 6, "goal_diff": 3, "goals_for": 5},
                {"team_id": "T3", "played": 3, "points": 4, "goal_diff": 0, "goals_for": 4},
                {"team_id": "T4", "played": 3, "points": 0, "goal_diff": -7, "goals_for": 1},
            ]
        }

    monkeypatch.setattr(server, "db", _FakeDb())
    monkeypatch.setattr(server, "compute_all_standings", _standings)

    rows = asyncio.run(server.leaderboard())
    assert len(rows) == 1
    row = rows[0]

    # Match accuracy for 1-0 vs 2-1:
    # outcome=4, exact goal diff with correct winner=2 => 6/11
    assert row["match_accuracy_points"] == 6
    assert row["match_accuracy_max"] == 11
    assert row["predicted_finished_matches"] == 1

    # Strategy picks counted as binary correctness when outcome is known:
    # group winner T1 correct (1/1), advancing picks T1 correct + ZZZ wrong (1/2) => 2/3
    assert row["strategy_correct_count"] == 2
    assert row["strategy_possible_count"] == 3
    assert row["correct_strategy_picks"] == 2

    # Combined: (6 + 2) / (11 + 3) * 100 = 57.14
    assert row["accuracy_percentage"] == 57.14
