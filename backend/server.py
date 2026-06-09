from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import secrets
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# ---------- Config ----------
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "gabriella.bengtsson2@gmail.com").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "WorldCup2026!")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Family World Cup 2026")
api = APIRouter(prefix="/api")

# ---------- Helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": now_utc() + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 60 * 60, path="/",
    )

# ---------- Models ----------
class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class ForgotPwReq(BaseModel):
    email: EmailStr

class ResetPwReq(BaseModel):
    token: str
    password: str = Field(min_length=6)

class TeamModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_name: str
    country_code: str  # ISO 3166-1 alpha-2 e.g. SE, BR, AR
    group: str  # "A" - "L"

class MatchModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stage: str = "group"  # group, r32, r16, qf, sf, final
    group: Optional[str] = None
    home_team_id: str
    away_team_id: str
    kickoff: datetime
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: Literal["upcoming", "live", "finished"] = "upcoming"

class MatchCreate(BaseModel):
    stage: str = "group"
    group: Optional[str] = None
    home_team_id: str
    away_team_id: str
    kickoff: datetime

class MatchResultReq(BaseModel):
    home_score: int
    away_score: int

class PredictionReq(BaseModel):
    match_id: str
    home_score: int
    away_score: int

class TournamentPredictionReq(BaseModel):
    version: int = Field(ge=1, le=4)
    group_winners: dict  # {"A": team_id, ...}
    group_runners_up: dict  # {"A": team_id, ...}
    r32: List[str] = []
    r16: List[str] = []
    qf: List[str] = []
    sf: List[str] = []
    finalists: List[str] = []
    champion: Optional[str] = None

# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Invite-only: allow registration only if email is in invites OR is the admin email
    invite = await db.invites.find_one({"email": email})
    if email != ADMIN_EMAIL and not invite:
        raise HTTPException(status_code=403, detail="This is a private app. Your email is not invited.")
    role = "admin" if email == ADMIN_EMAIL else "user"
    user = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "email": email,
        "password_hash": hash_password(req.password),
        "role": role,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    if invite:
        await db.invites.delete_one({"email": email})
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/login")
async def login(req: LoginReq, response: Response):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPwReq):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"ok": True}  # Don't reveal
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user["id"],
        "expires_at": (now_utc() + timedelta(hours=1)).isoformat(),
        "used": False,
    })
    print(f"[PASSWORD RESET] {email} -> token: {token}")
    return {"ok": True, "reset_token": token}  # Returned for dev convenience

@api.post("/auth/reset-password")
async def reset_password(req: ResetPwReq):
    doc = await db.password_reset_tokens.find_one({"token": req.token, "used": False})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or used token")
    if datetime.fromisoformat(doc["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one(
        {"id": doc["user_id"]},
        {"$set": {"password_hash": hash_password(req.password)}},
    )
    await db.password_reset_tokens.update_one({"token": req.token}, {"$set": {"used": True}})
    return {"ok": True}

# ---------- Teams ----------
@api.get("/teams")
async def list_teams():
    teams = await db.teams.find({}, {"_id": 0}).to_list(200)
    return sorted(teams, key=lambda t: (t.get("group", "Z"), t["team_name"]))

@api.get("/teams/groups")
async def teams_by_group():
    teams = await db.teams.find({}, {"_id": 0}).to_list(200)
    groups = {}
    for t in teams:
        groups.setdefault(t["group"], []).append(t)
    for g in groups:
        groups[g].sort(key=lambda x: x["team_name"])
    return groups

# ---------- Matches ----------
@api.get("/matches")
async def list_matches():
    matches = await db.matches.find({}, {"_id": 0}).to_list(1000)
    # Attach team objects
    team_ids = list({m["home_team_id"] for m in matches} | {m["away_team_id"] for m in matches})
    teams = await db.teams.find({"id": {"$in": team_ids}}, {"_id": 0}).to_list(200)
    tmap = {t["id"]: t for t in teams}
    for m in matches:
        m["home_team"] = tmap.get(m["home_team_id"])
        m["away_team"] = tmap.get(m["away_team_id"])
        if isinstance(m.get("kickoff"), str):
            pass
    matches.sort(key=lambda m: m["kickoff"])
    return matches

@api.post("/matches", dependencies=[Depends(require_admin)])
async def create_match(req: MatchCreate):
    m = MatchModel(**req.model_dump()).model_dump()
    m["kickoff"] = m["kickoff"].isoformat() if isinstance(m["kickoff"], datetime) else m["kickoff"]
    await db.matches.insert_one(m)
    m.pop("_id", None)
    return m

@api.put("/matches/{match_id}/result", dependencies=[Depends(require_admin)])
async def set_result(match_id: str, req: MatchResultReq):
    res = await db.matches.update_one(
        {"id": match_id},
        {"$set": {"home_score": req.home_score, "away_score": req.away_score, "status": "finished"}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Match not found")
    await recompute_live_points()
    return {"ok": True}

@api.delete("/matches/{match_id}", dependencies=[Depends(require_admin)])
async def delete_match(match_id: str):
    await db.matches.delete_one({"id": match_id})
    await db.match_predictions.delete_many({"match_id": match_id})
    return {"ok": True}

# ---------- Match Predictions ----------
@api.post("/predictions")
async def submit_prediction(req: PredictionReq, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"id": req.match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    kickoff = datetime.fromisoformat(match["kickoff"]) if isinstance(match["kickoff"], str) else match["kickoff"]
    if kickoff.tzinfo is None:
        kickoff = kickoff.replace(tzinfo=timezone.utc)
    if now_utc() >= kickoff:
        raise HTTPException(status_code=400, detail="Predictions are locked for this match")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "match_id": req.match_id,
        "home_score": req.home_score,
        "away_score": req.away_score,
        "submitted_at": now_utc().isoformat(),
    }
    await db.match_predictions.update_one(
        {"user_id": user["id"], "match_id": req.match_id},
        {"$set": doc}, upsert=True,
    )
    return doc

@api.get("/predictions/me")
async def my_predictions(user: dict = Depends(get_current_user)):
    preds = await db.match_predictions.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return preds

@api.get("/predictions/match/{match_id}")
async def match_predictions_visible(match_id: str, user: dict = Depends(get_current_user)):
    match = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    kickoff = datetime.fromisoformat(match["kickoff"]) if isinstance(match["kickoff"], str) else match["kickoff"]
    if kickoff.tzinfo is None:
        kickoff = kickoff.replace(tzinfo=timezone.utc)
    # Hide predictions until kickoff
    if now_utc() < kickoff and user.get("role") != "admin":
        return {"locked": True, "predictions": []}
    preds = await db.match_predictions.find({"match_id": match_id}, {"_id": 0}).to_list(500)
    users = await db.users.find({"id": {"$in": [p["user_id"] for p in preds]}}, {"_id": 0, "password_hash": 0}).to_list(500)
    umap = {u["id"]: u for u in users}
    for p in preds:
        p["user"] = umap.get(p["user_id"], {})
    return {"locked": False, "predictions": preds}

# ---------- Tournament Predictions ----------
@api.post("/tournament-predictions")
async def submit_tp(req: TournamentPredictionReq, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "version": req.version,
        "group_winners": req.group_winners,
        "group_runners_up": req.group_runners_up,
        "r32": req.r32,
        "r16": req.r16,
        "qf": req.qf,
        "sf": req.sf,
        "finalists": req.finalists,
        "champion": req.champion,
        "submitted_at": now_utc().isoformat(),
    }
    # Mark late v1 if deadline passed
    cfg = await db.config.find_one({"key": "v1_deadline"}) or {}
    is_late = False
    if req.version == 1 and cfg.get("value"):
        dl = datetime.fromisoformat(cfg["value"])
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        is_late = now_utc() > dl
    doc["is_late"] = is_late
    await db.tournament_predictions.update_one(
        {"user_id": user["id"], "version": req.version},
        {"$set": doc}, upsert=True,
    )
    return doc

@api.get("/tournament-predictions/me")
async def my_tp(user: dict = Depends(get_current_user)):
    docs = await db.tournament_predictions.find({"user_id": user["id"]}, {"_id": 0}).to_list(10)
    return docs

@api.get("/tournament-predictions/all", dependencies=[Depends(require_admin)])
async def all_tp():
    docs = await db.tournament_predictions.find({}, {"_id": 0}).to_list(1000)
    return docs

# ---------- Leaderboard ----------
def score_match(pred_h, pred_a, actual_h, actual_a) -> int:
    if actual_h is None or actual_a is None:
        return 0
    pts = 0
    pred_winner = (pred_h > pred_a) - (pred_h < pred_a)
    actual_winner = (actual_h > actual_a) - (actual_h < actual_a)
    if pred_winner == actual_winner:
        pts += 3
    if (pred_h - pred_a) == (actual_h - actual_a):
        pts += 2
    if pred_h == actual_h and pred_a == actual_a:
        pts += 5
    return pts  # max 10

async def recompute_live_points():
    matches = await db.matches.find({"status": "finished"}, {"_id": 0}).to_list(1000)
    mmap = {m["id"]: m for m in matches}
    preds = await db.match_predictions.find({}, {"_id": 0}).to_list(10000)
    user_points = {}
    for p in preds:
        m = mmap.get(p["match_id"])
        if not m:
            continue
        pts = score_match(p["home_score"], p["away_score"], m.get("home_score"), m.get("away_score"))
        user_points[p["user_id"]] = user_points.get(p["user_id"], 0) + pts
    # Persist
    for uid, pts in user_points.items():
        await db.users.update_one({"id": uid}, {"$set": {"live_points": pts}})
    # Reset for users with no predictions
    all_users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for u in all_users:
        if u["id"] not in user_points:
            await db.users.update_one({"id": u["id"]}, {"$set": {"live_points": 0}})

@api.get("/leaderboard")
async def leaderboard():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    rows = []
    for u in users:
        live = u.get("live_points", 0) or 0
        strat = u.get("strategy_points", 0) or 0
        rows.append({
            "user_id": u["id"], "name": u["name"], "email": u["email"],
            "live_points": live, "strategy_points": strat,
            "total_points": live + strat, "role": u.get("role", "user"),
        })
    rows.sort(key=lambda r: r["total_points"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows

# ---------- Admin ----------
class InviteReq(BaseModel):
    email: EmailStr

@api.get("/admin/users", dependencies=[Depends(require_admin)])
async def admin_users():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api.put("/admin/users/{user_id}/role", dependencies=[Depends(require_admin)])
async def set_user_role(user_id: str, role: dict):
    new_role = role.get("role")
    if new_role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    return {"ok": True}

@api.delete("/admin/users/{user_id}", dependencies=[Depends(require_admin)])
async def delete_user(user_id: str):
    await db.users.delete_one({"id": user_id})
    await db.match_predictions.delete_many({"user_id": user_id})
    await db.tournament_predictions.delete_many({"user_id": user_id})
    return {"ok": True}

@api.post("/admin/invite", dependencies=[Depends(require_admin)])
async def invite_email(req: InviteReq):
    email = req.email.lower()
    await db.invites.update_one({"email": email}, {"$set": {"email": email, "invited_at": now_utc().isoformat()}}, upsert=True)
    return {"ok": True}

@api.get("/admin/invites", dependencies=[Depends(require_admin)])
async def list_invites():
    invs = await db.invites.find({}, {"_id": 0}).to_list(500)
    return invs

@api.delete("/admin/invites/{email}", dependencies=[Depends(require_admin)])
async def remove_invite(email: str):
    await db.invites.delete_one({"email": email.lower()})
    return {"ok": True}

class StrategyReq(BaseModel):
    user_id: str
    points: int

@api.post("/admin/strategy-points", dependencies=[Depends(require_admin)])
async def set_strategy_points(req: StrategyReq):
    await db.users.update_one({"id": req.user_id}, {"$set": {"strategy_points": req.points}})
    return {"ok": True}

@api.post("/admin/recompute", dependencies=[Depends(require_admin)])
async def admin_recompute():
    await recompute_live_points()
    return {"ok": True}

# ---------- Seed Data ----------
TEAMS_SEED = [
    # Group A
    {"team_name": "Mexico", "country_code": "MX", "group": "A"},
    {"team_name": "Poland", "country_code": "PL", "group": "A"},
    {"team_name": "Ecuador", "country_code": "EC", "group": "A"},
    {"team_name": "Senegal", "country_code": "SN", "group": "A"},
    # Group B
    {"team_name": "England", "country_code": "GB", "group": "B"},
    {"team_name": "Iran", "country_code": "IR", "group": "B"},
    {"team_name": "USA", "country_code": "US", "group": "B"},
    {"team_name": "Wales", "country_code": "GB", "group": "B"},
    # Group C
    {"team_name": "Argentina", "country_code": "AR", "group": "C"},
    {"team_name": "Saudi Arabia", "country_code": "SA", "group": "C"},
    {"team_name": "Mexico B", "country_code": "MX", "group": "C"},
    {"team_name": "Costa Rica", "country_code": "CR", "group": "C"},
    # Group D
    {"team_name": "France", "country_code": "FR", "group": "D"},
    {"team_name": "Australia", "country_code": "AU", "group": "D"},
    {"team_name": "Denmark", "country_code": "DK", "group": "D"},
    {"team_name": "Tunisia", "country_code": "TN", "group": "D"},
    # Group E
    {"team_name": "Spain", "country_code": "ES", "group": "E"},
    {"team_name": "Germany", "country_code": "DE", "group": "E"},
    {"team_name": "Japan", "country_code": "JP", "group": "E"},
    {"team_name": "Costa Rica B", "country_code": "CR", "group": "E"},
    # Group F
    {"team_name": "Belgium", "country_code": "BE", "group": "F"},
    {"team_name": "Canada", "country_code": "CA", "group": "F"},
    {"team_name": "Morocco", "country_code": "MA", "group": "F"},
    {"team_name": "Croatia", "country_code": "HR", "group": "F"},
    # Group G
    {"team_name": "Brazil", "country_code": "BR", "group": "G"},
    {"team_name": "Serbia", "country_code": "RS", "group": "G"},
    {"team_name": "Switzerland", "country_code": "CH", "group": "G"},
    {"team_name": "Cameroon", "country_code": "CM", "group": "G"},
    # Group H
    {"team_name": "Portugal", "country_code": "PT", "group": "H"},
    {"team_name": "Ghana", "country_code": "GH", "group": "H"},
    {"team_name": "Uruguay", "country_code": "UY", "group": "H"},
    {"team_name": "South Korea", "country_code": "KR", "group": "H"},
    # Group I
    {"team_name": "Netherlands", "country_code": "NL", "group": "I"},
    {"team_name": "Norway", "country_code": "NO", "group": "I"},
    {"team_name": "Egypt", "country_code": "EG", "group": "I"},
    {"team_name": "Colombia", "country_code": "CO", "group": "I"},
    # Group J
    {"team_name": "Italy", "country_code": "IT", "group": "J"},
    {"team_name": "Nigeria", "country_code": "NG", "group": "J"},
    {"team_name": "Sweden", "country_code": "SE", "group": "J"},
    {"team_name": "Paraguay", "country_code": "PY", "group": "J"},
    # Group K
    {"team_name": "Austria", "country_code": "AT", "group": "K"},
    {"team_name": "Algeria", "country_code": "DZ", "group": "K"},
    {"team_name": "Peru", "country_code": "PE", "group": "K"},
    {"team_name": "Jamaica", "country_code": "JM", "group": "K"},
    # Group L
    {"team_name": "Ukraine", "country_code": "UA", "group": "L"},
    {"team_name": "Scotland", "country_code": "GB", "group": "L"},
    {"team_name": "Chile", "country_code": "CL", "group": "L"},
    {"team_name": "Panama", "country_code": "PA", "group": "L"},
]

async def seed_db():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.teams.create_index("id", unique=True)
    await db.matches.create_index("id", unique=True)
    await db.match_predictions.create_index([("user_id", 1), ("match_id", 1)], unique=True)
    await db.tournament_predictions.create_index([("user_id", 1), ("version", 1)], unique=True)
    await db.invites.create_index("email", unique=True)

    # Admin
    existing_admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing_admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Gabriella Bengtsson",
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": now_utc().isoformat(),
            "live_points": 0,
            "strategy_points": 0,
        })
        logger.info("Seeded admin user")

    # Teams
    if await db.teams.count_documents({}) == 0:
        teams = [TeamModel(**t).model_dump() for t in TEAMS_SEED]
        await db.teams.insert_many(teams)
        logger.info(f"Seeded {len(teams)} teams")

    # Sample matches (one per group, simple round-robin starter)
    if await db.matches.count_documents({}) == 0:
        groups_teams = {}
        cur = db.teams.find({}, {"_id": 0})
        async for t in cur:
            groups_teams.setdefault(t["group"], []).append(t)
        sample_matches = []
        base = now_utc() + timedelta(days=2)
        for i, (g, ts) in enumerate(sorted(groups_teams.items())):
            if len(ts) >= 2:
                kickoff = base + timedelta(hours=i * 3)
                sample_matches.append({
                    "id": str(uuid.uuid4()),
                    "stage": "group",
                    "group": g,
                    "home_team_id": ts[0]["id"],
                    "away_team_id": ts[1]["id"],
                    "kickoff": kickoff.isoformat(),
                    "home_score": None,
                    "away_score": None,
                    "status": "upcoming",
                })
            if len(ts) >= 4:
                kickoff = base + timedelta(hours=i * 3 + 1)
                sample_matches.append({
                    "id": str(uuid.uuid4()),
                    "stage": "group",
                    "group": g,
                    "home_team_id": ts[2]["id"],
                    "away_team_id": ts[3]["id"],
                    "kickoff": kickoff.isoformat(),
                    "home_score": None,
                    "away_score": None,
                    "status": "upcoming",
                })
        if sample_matches:
            await db.matches.insert_many(sample_matches)
            logger.info(f"Seeded {len(sample_matches)} sample matches")

@app.on_event("startup")
async def on_startup():
    await seed_db()

# ---------- Mount ----------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
