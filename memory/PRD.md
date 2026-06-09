# Family World Cup 2026 — PRD

## Problem Statement
Private, mobile-first prediction web app called **Family World Cup 2026**. Family + friends predict FIFA World Cup 2026 matches and the full tournament bracket (Versions 1–4). Not real-money. Built with **FastAPI + MongoDB + React** (Supabase not available on platform — confirmed by user).

## User Personas
- **Admin** (Gabriella Bengtsson, `gabriella.bengtsson2@gmail.com`): imports matches, manages teams, manages users, enters results, manages tournament versions, assigns/revokes admin role, invites family.
- **Player** (invited family/friend): registers via invited email, submits match predictions and tournament (V1–V4) predictions, tracks ranking on the leaderboard.

## Core Requirements
- JWT auth (email + password, bcrypt), invite-only registration, role-based admin gating.
- 48 FIFA WC 2026 teams pre-seeded with `team_name` + ISO `country_code`, groups A–L, replaceable by admin import.
- Match scoring: 3 (winner) + 2 (goal diff) + 5 (exact) = max 10 pts/match.
- Tournament scoring (Strategy pts) with version multipliers V1 100% / V2 75% / V3 50% / V4 25%; late V1 flagged with timestamp.
- Leaderboard with **Live + Strategy + Total** columns, sortable tabs, current user highlighted.
- Country flags everywhere via `react-country-flag` SVG.
- Predictions hidden until match kick-off; locked after.

## Implemented (2026-02)
- Backend (server.py): auth (register/login/logout/me/forgot/reset), teams, matches CRUD (admin), match predictions (upsert + lock), tournament predictions (upsert per version, late-flag), leaderboard with live + strategy + total, admin (users, roles, invites, manual strategy points, recompute).
- Frontend pages: Login, Register, Dashboard, Matches, Leaderboard, Tournament Prediction (V1–V4 with group winners/runners-up + knockout stage pickers + champion), Admin (matches/users/invites/scoring tabs).
- Mobile-first dark "Performance Pro" theme, Outfit + Manrope fonts, neon cyan/lime accents.
- Pre-seeded: 1 admin, 48 teams, 24 sample matches.
- Tested: 18/18 backend pytest, frontend smoke verified.

## Backlog (P1)
- Excel/CSV match import on Admin page (admin will upload real fixtures).
- Automated strategy-points calculation from tournament predictions vs. real results (currently manual override).
- Password reset email (currently logs token to backend stdout).
- Lock V1 tournament predictions at a configurable deadline (UI for setting `config.v1_deadline`).

## Backlog (P2)
- Live polling / websockets for in-progress matches.
- Public share link for family chat group.
- Per-user prediction history page.
- Bracket connector lines visualization.
