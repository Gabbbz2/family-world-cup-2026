# Family World Cup 2026 — PRD

## Problem Statement
Private, mobile-first FIFA World Cup 2026 prediction web app for family + friends. Stack: **FastAPI + MongoDB + React** (Supabase not available on platform).

## User Personas
- **Admin** (Gabriella Bengtsson, `gabriella.bengtsson2@gmail.com`): manages teams, fixtures, results, users, invites, DQ; sets V1 deadline; reviews audit log.
- **Player** (invited): registers via invite, submits match + tournament predictions (V1–V4), tracks Live/Strategy/Total points on leaderboard.

## Core Requirements
- JWT auth + invite-only registration.
- 48 FIFA WC 2026 teams + 104 matches imported from official xlsx fixture file.
- Match scoring: 3 winner + 2 goal-diff + 5 exact (max 10/match).
- Tournament strategy: group winner +5, advancing +3, R32 +4, R16 +6, QF +8, SF +12, finalist +20, champion +30; multipliers V1 100% / V2 75% / V3 50% / V4 25%; late V1 flagged.
- Group rankings 1st–4th per group (unique selection enforced).
- Auto-progression: group standings compute, placeholders (1A, 2B, 3ABCDF, W73, RU101) resolve when source matches/groups complete.
- Admin Results page with edit/clear/recompute/progress controls.
- Team DQ with required reason + audit log.
- Excel/CSV import (preview + replace).
- V1 deadline configuration.
- Mobile-first FIFA-style dark UI with `react-country-flag` SVG flags everywhere.

## Implemented (2026-02 / iteration 2 + 3)
- All endpoints + auto-imported xlsx (48 teams, 72 group + 32 knockout matches, TV channels).
- Auto-progression: group standings + placeholder resolution + strategy recompute.
- Admin Panel with 8 tabs: Results, Teams/DQ, Import, V1 Deadline, Users, Invites, Scoring, Audit Log.
- Tournament Prediction with full 1st–4th group rankings (unique enforcement) + bracket stages + champion.
- Dashboard group standings preview + upcoming matches with TV/round badges.
- Winner highlight (green) / loser dim on finished matches.
- Audit log for every admin mutating action.
- **(iter 3)** Swedish locale + Europe/Stockholm timezone everywhere in the UI (e.g. `Torsdag 11 juni · 21:00`). Backend stays UTC internally. Admin datetime inputs convert Swedish wall-clock ↔ UTC correctly across DST.
- Tested: 29/29 backend pytest passing + frontend 100% on iter-2 and iter-3 criteria.

## Backlog (P1)
- DRY-extract progression placeholder logic into helper.
- Server-side validation that group_rankings team IDs belong to the named group.
- Pagination/virtualization on the 104-row admin Results list.
- Password reset email delivery (token currently logs to backend stdout).
- `import-commit` should return 422 on parse errors instead of 200 + `ok:false`.

## Backlog (P2)
- Live polling / websockets for in-progress matches.
- Public WhatsApp/Telegram share link.
- Per-user prediction history page.
- Bracket connector-lines visual.
- Split server.py into multiple routers/services modules.
