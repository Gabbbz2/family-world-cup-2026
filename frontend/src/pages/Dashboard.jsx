import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { FlagTeam, Flag } from "../components/FlagTeam";
import { Trophy, Strategy, CalendarBlank, CaretRight, Television } from "@phosphor-icons/react";
import { fmtSwedishShort } from "../lib/dates";

function fmtKick(iso) {
  return fmtSwedishShort(iso);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [board, setBoard] = useState([]);
  const [standings, setStandings] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const [m, l, s] = await Promise.all([api.get("/matches"), api.get("/leaderboard"), api.get("/standings")]);
        setMatches(m.data); setBoard(l.data); setStandings(s.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const upcoming = matches.filter((m) => m.status !== "finished" && m.home_team && m.away_team).slice(0, 5);
  const myRow = board.find((r) => r.user_id === user.id);
  const groupKeys = Object.keys(standings).sort().slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden surface p-6">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#00F0FF]/10 blur-3xl" />
        <div className="label-eyebrow">Welcome back</div>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter mt-1" data-testid="dashboard-greeting">
          {user.name?.split(" ")[0] || "Player"}.
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">Lock in your picks before kick-off. Hidden until the whistle.</p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="border border-white/10 p-3">
            <div className="label-eyebrow">Rank</div>
            <div className="font-display font-black text-2xl text-[#00F0FF]" data-testid="my-rank">{myRow ? `#${myRow.rank}` : "—"}</div>
          </div>
          <div className="border border-white/10 p-3">
            <div className="label-eyebrow">Live Pts</div>
            <div className="font-display font-black text-2xl" data-testid="my-live-pts">{myRow?.live_points ?? 0}</div>
          </div>
          <div className="border border-white/10 p-3">
            <div className="label-eyebrow">Total</div>
            <div className="font-display font-black text-2xl text-[#39FF14]" data-testid="my-total-pts">{myRow?.total_points ?? 0}</div>
          </div>
        </div>
        <Link to="/tournament" data-testid="cta-tournament"
          className="mt-5 inline-flex items-center justify-between w-full bg-[#00F0FF] text-black px-4 py-3 font-bold uppercase tracking-widest text-sm hover:bg-white transition-all">
          <span className="flex items-center gap-2"><Strategy size={20} weight="fill" /> Submit Tournament Prediction</span>
          <CaretRight size={18} weight="bold" />
        </Link>
      </section>

      {/* Upcoming */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-xl flex items-center gap-2">
            <CalendarBlank size={20} weight="fill" className="text-[#00F0FF]" /> Upcoming Matches
          </h2>
          <Link to="/matches" data-testid="cta-matches" className="text-xs uppercase tracking-widest text-[#00F0FF] hover:underline">View all</Link>
        </div>
        <div className="surface divide-y divide-white/10">
          {upcoming.length === 0 && <div className="p-6 text-zinc-500 text-sm text-center">No upcoming matches yet.</div>}
          {upcoming.map((m) => (
            <Link to="/matches" key={m.id} data-testid={`dash-match-${m.id}`}
              className="block p-3 hover:bg-white/5 transition-all">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                <span>#{m.match_number} · {m.round || m.stage}{m.group ? ` · G ${m.group}` : ""}</span>
                <span className="inline-flex items-center gap-1">
                  {m.tv_channel && <><Television size={12} className="text-[#FFCC00]" /><span className="text-[#FFCC00]">{m.tv_channel}</span>·</>}
                  {fmtKick(m.kickoff)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0"><FlagTeam team={m.home_team} placeholder={m.home_placeholder} size={20} /></div>
                <span className="text-zinc-500 text-xs uppercase tracking-widest px-2">vs</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end"><FlagTeam team={m.away_team} placeholder={m.away_placeholder} size={20} reverse /></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Group standings preview */}
      {groupKeys.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-xl">Group Standings</h2>
            <Link to="/matches" className="text-xs uppercase tracking-widest text-[#00F0FF] hover:underline">All matches</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {groupKeys.map((g) => (
              <div key={g} className="surface p-3" data-testid={`dash-standings-${g}`}>
                <div className="label-eyebrow mb-2">Group {g}</div>
                <table className="w-full text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="text-left">Team</th>
                      <th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings[g].map((r, idx) => (
                      <tr key={r.team_id} className={idx < 2 ? "text-white" : "text-zinc-400"}>
                        <td className="text-left py-1">
                          <span className="inline-flex items-center gap-1.5">
                            <Flag code={r.country_code} size={14} />
                            <span className="truncate">{r.team_name}</span>
                          </span>
                        </td>
                        <td className="text-center font-mono">{r.played}</td>
                        <td className="text-center font-mono">{r.won}</td>
                        <td className="text-center font-mono">{r.drawn}</td>
                        <td className="text-center font-mono">{r.lost}</td>
                        <td className="text-center font-mono">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</td>
                        <td className="text-center font-mono font-bold text-[#39FF14]">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-xl flex items-center gap-2">
            <Trophy size={20} weight="fill" className="text-[#39FF14]" /> Leaderboard
          </h2>
          <Link to="/leaderboard" data-testid="cta-leaderboard" className="text-xs uppercase tracking-widest text-[#00F0FF] hover:underline">See full board</Link>
        </div>
        <div className="surface">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 label-eyebrow border-b border-white/10">
            <div className="col-span-1">#</div><div className="col-span-5">Player</div>
            <div className="col-span-2 text-right">Live</div><div className="col-span-2 text-right">Strat</div><div className="col-span-2 text-right">Total</div>
          </div>
          {board.slice(0, 5).map((r) => (
            <div key={r.user_id} data-testid={`dash-board-row-${r.user_id}`}
              className={`grid grid-cols-12 gap-2 px-3 py-3 border-b border-white/5 text-sm ${r.user_id === user.id ? "bg-[#00F0FF]/5" : ""}`}>
              <div className="col-span-1 font-display font-black">{r.rank}</div>
              <div className="col-span-5 truncate">{r.name}</div>
              <div className="col-span-2 text-right font-mono">{r.live_points}</div>
              <div className="col-span-2 text-right font-mono">{r.strategy_points}</div>
              <div className="col-span-2 text-right font-mono font-bold text-[#39FF14]">{r.total_points}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
