import asyncio
import os

import pytest
from fastapi import HTTPException

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_db")

import server


class _AsyncCursor:
    def __init__(self, rows):
        self._rows = rows

    async def to_list(self, _):
        return list(self._rows)


class _ReadCollection:
    def __init__(self, rows):
        self._rows = rows

    def find(self, *args, **kwargs):
        return _AsyncCursor(self._rows)


class _TournamentPredictionsCollection:
    def __init__(self, find_one_doc=None, find_rows=None):
        self._find_one_doc = find_one_doc
        self._find_rows = find_rows or []
        self.last_update = None

    async def find_one(self, *args, **kwargs):
        return self._find_one_doc

    def find(self, *args, **kwargs):
        return _AsyncCursor(self._find_rows)

    async def update_one(self, query, update, upsert=False):
        self.last_update = {"query": query, "update": update, "upsert": upsert}


class _UsersCollection:
    def __init__(self, rows):
        self._rows = rows
        self.updated = []

    def find(self, *args, **kwargs):
        return _AsyncCursor(self._rows)

    async def update_one(self, query, update):
        self.updated.append({"query": query, "update": update})


class _FakeDb:
    def __init__(self, tp_find_one_doc=None, tp_find_rows=None, matches_rows=None, users_rows=None):
        self.tournament_predictions = _TournamentPredictionsCollection(tp_find_one_doc, tp_find_rows)
        self.matches = _ReadCollection(matches_rows or [])
        self.users = _UsersCollection(users_rows or [])


def _team(tid, name):
    return {"id": tid, "team_name": name, "country_code": tid, "group": "X"}


def _sf_templates():
    # Two semifinals with fixed teams; final and bronze derive from W/RU placeholders.
    return {
        "r32": [],
        "r16": [],
        "qf": [],
        "sf": [
            {
                "id": "sf1",
                "stage": "Knockout",
                "round": "semifinal",
                "match_number": 101,
                "home_team_id": "A",
                "away_team_id": "B",
                "home_team": _team("A", "Alpha"),
                "away_team": _team("B", "Bravo"),
                "home_placeholder": None,
                "away_placeholder": None,
                "status": "finished",
                "home_score": 2,
                "away_score": 0,
            },
            {
                "id": "sf2",
                "stage": "Knockout",
                "round": "semifinal",
                "match_number": 102,
                "home_team_id": "C",
                "away_team_id": "D",
                "home_team": _team("C", "Charlie"),
                "away_team": _team("D", "Delta"),
                "home_placeholder": None,
                "away_placeholder": None,
                "status": "finished",
                "home_score": 0,
                "away_score": 1,
            },
        ],
        "third_place": [
            {
                "id": "br1",
                "stage": "Knockout",
                "round": "bronsmatch",
                "match_number": 103,
                "home_team_id": "B",
                "away_team_id": "C",
                "home_team": _team("B", "Bravo"),
                "away_team": _team("C", "Charlie"),
                "home_placeholder": "RU101",
                "away_placeholder": "RU102",
                "status": "finished",
                "home_score": 1,
                "away_score": 0,
            }
        ],
        "final": [
            {
                "id": "f1",
                "stage": "Knockout",
                "round": "final",
                "match_number": 104,
                "home_team_id": "A",
                "away_team_id": "D",
                "home_team": _team("A", "Alpha"),
                "away_team": _team("D", "Delta"),
                "home_placeholder": "W101",
                "away_placeholder": "W102",
                "status": "finished",
                "home_score": 0,
                "away_score": 1,
            }
        ],
    }


def test_strategy_tree_preview_generates_forward_rounds(monkeypatch):
    async def _templates():
        return _sf_templates()

    monkeypatch.setattr(server, "_knockout_templates_by_stage", _templates)

    req = server.StrategySubmitReq(
        picks={
            "sf": {"sf1": "A", "sf2": "D"},
            "third_place": {"br1": "B"},
            "final": {"f1": "D"},
        },
        champion="D",
        bronze_winner="B",
    )
    payload = asyncio.run(server.strategy_version_tree_preview("sf", req, user={"id": "u1"}))

    assert payload["starting_matches_exist"] is True
    assert payload["generated_matches"]["final"][0]["home_team_id"] == "A"
    assert payload["generated_matches"]["final"][0]["away_team_id"] == "D"
    assert payload["generated_matches"]["third_place"][0]["home_team_id"] == "B"
    assert payload["generated_matches"]["third_place"][0]["away_team_id"] == "C"


def test_submit_strategy_version_requires_complete_start_round(monkeypatch):
    async def _templates():
        return _sf_templates()

    async def _state(_version_id):
        return {"locked": False}

    monkeypatch.setattr(server, "_knockout_templates_by_stage", _templates)
    monkeypatch.setattr(server, "get_version_state", _state)
    monkeypatch.setattr(server, "db", _FakeDb())

    req = server.StrategySubmitReq(
        picks={"sf": {"sf1": "A"}},
        champion="D",
        bronze_winner="B",
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.submit_strategy_version("sf", req, user={"id": "u1"}))
    assert exc.value.status_code == 400
    assert "startomgången" in exc.value.detail.lower() or "välj en vinnare" in exc.value.detail.lower()


def test_submit_strategy_version_saves_full_tree(monkeypatch):
    async def _templates():
        return _sf_templates()

    async def _state(_version_id):
        return {"locked": False}

    fake_db = _FakeDb()
    monkeypatch.setattr(server, "_knockout_templates_by_stage", _templates)
    monkeypatch.setattr(server, "get_version_state", _state)
    monkeypatch.setattr(server, "db", fake_db)

    req = server.StrategySubmitReq(
        picks={
            "sf": {"sf1": "A", "sf2": "D"},
            "third_place": {"br1": "B"},
            "final": {"f1": "D"},
        },
        champion="D",
        bronze_winner="B",
    )
    out = asyncio.run(server.submit_strategy_version("sf", req, user={"id": "u1"}))

    assert out["version"] == "sf"
    saved = fake_db.tournament_predictions.last_update["update"]["$set"]
    assert saved["starting_round"] == "sf"
    assert saved["champion"] == "D"
    assert saved["bronze_winner"] == "B"
    assert "generated_matches" in saved
    assert "sf" in saved["picks"]


def test_strategy_version_tree_flags_duplicate_teams(monkeypatch):
    templates = _sf_templates()
    templates["sf"][1]["home_team_id"] = "A"
    templates["sf"][1]["home_team"] = _team("A", "Alpha")

    async def _templates():
        return templates

    fake_db = _FakeDb(
        tp_find_one_doc={
            "version": "sf",
            "picks": {"sf": {"sf1": "A", "sf2": "D"}, "third_place": {"br1": "B"}, "final": {"f1": "D"}},
            "champion": "D",
            "bronze_winner": "B",
        }
    )
    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setattr(server, "_knockout_templates_by_stage", _templates)

    payload = asyncio.run(server.strategy_version_tree("sf", user={"id": "u1"}))
    assert payload["has_duplicate_teams"] is True
    assert payload["warnings"]


def test_recompute_strategy_points_uses_stage_matrix(monkeypatch):
    async def _standings():
        return {}

    fake_db = _FakeDb(
        tp_find_rows=[
            {
                "user_id": "u1",
                "version": "sf",
                "picks": {"sf": {"sf1": "A"}, "third_place": {"br1": "B"}, "final": {"f1": "D"}},
                "champion": "D",
                "bronze_winner": "B",
            }
        ],
        matches_rows=[
            {
                "id": "sf1",
                "stage": "Knockout",
                "round": "semifinal",
                "status": "finished",
                "home_team_id": "A",
                "away_team_id": "C",
                "home_score": 1,
                "away_score": 0,
            },
            {
                "id": "br1",
                "stage": "Knockout",
                "round": "bronsmatch",
                "status": "finished",
                "home_team_id": "B",
                "away_team_id": "C",
                "home_score": 2,
                "away_score": 1,
            },
            {
                "id": "f1",
                "stage": "Knockout",
                "round": "final",
                "status": "finished",
                "home_team_id": "A",
                "away_team_id": "D",
                "home_score": 0,
                "away_score": 1,
            },
        ],
        users_rows=[{"id": "u1"}],
    )

    monkeypatch.setattr(server, "compute_all_standings", _standings)
    monkeypatch.setattr(server, "db", fake_db)

    asyncio.run(server.recompute_strategy_points())

    # sf=4 + bronze=3 + champion=5 = 12
    assert fake_db.users.updated
    latest_update = fake_db.users.updated[-1]["update"]["$set"]
    assert latest_update["strategy_points"] == 12
