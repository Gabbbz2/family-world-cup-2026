import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { FlagTeam } from "../components/FlagTeam";
import { LockKey, CheckCircle, EyeSlash, Clock } from "@phosphor-icons/react";

function fmtKickoff(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function MatchRow({ match, myPred, onSubmit }) {
  const { user } = useAuth();
  const locked = new Date(match.kickoff) <= new Date();
  const [h, setH] = useState(myPred?.home_score ?? "");
  const [a, setA] = useState(myPred?.away_score ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [othersOpen, setOthersOpen] = useState(false);
  const [others, setOthers] = useState(null);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      await onSubmit(match.id, parseInt(h), parseInt(a));
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const loadOthers = async () => {
    setOthersOpen(true);
    if (!others) {
      try {
        const { data } = await api.get(`/predictions/match/${match.id}`);
        setOthers(data);
      } catch (e) {
        setOthers({ locked: true, predictions: [] });
      }
    }
  };

  return (
    <div className="surface p-4" data-testid={`match-card-${match.id}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="label-eyebrow">{match.stage === "group" ? `Group ${match.group}` : match.stage.toUpperCase()}</span>
        <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
          <Clock size={14} /> {fmtKickoff(match.kickoff)}
        </span>
      </div>

      <div className="grid grid-cols-7 items-center gap-2">
        <div className="col-span-3"><FlagTeam team={match.home_team} size={22} /></div>
        <div className="col-span-1 text-center">
          {match.status === "finished" ? (
            <div className="font-display font-black text-2xl text-[#39FF14]">
              {match.home_score} : {match.away_score}
            </div>
          ) : (
            <span className="label-eyebrow text-zinc-500">vs</span>
          )}
        </div>
        <div className="col-span-3 flex justify-end"><FlagTeam team={match.away_team} size={22} reverse /></div>
      </div>

      {/* Prediction input */}
      <div className="mt-4 border-t border-white/10 pt-3">
        {locked ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 inline-flex items-center gap-1"><LockKey size={14} /> Predictions locked</span>
            {myPred ? (
              <span className="text-[#00F0FF] font-mono">My pick: {myPred.home_score} : {myPred.away_score}</span>
            ) : (
              <span className="text-zinc-600 text-xs">No pick submitted</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              data-testid={`pred-home-${match.id}`}
              type="number" min={0} max={20}
              value={h}
              onChange={(e) => setH(e.target.value)}
              className="w-14 bg-[#0A0A0A] border border-white/10 text-center py-2 focus:border-[#00F0FF]"
              placeholder="0"
            />
            <span className="text-zinc-500">:</span>
            <input
              data-testid={`pred-away-${match.id}`}
              type="number" min={0} max={20}
              value={a}
              onChange={(e) => setA(e.target.value)}
              className="w-14 bg-[#0A0A0A] border border-white/10 text-center py-2 focus:border-[#00F0FF]"
              placeholder="0"
            />
            <button
              data-testid={`pred-save-${match.id}`}
              onClick={submit}
              disabled={busy || h === "" || a === ""}
              className="ml-auto bg-[#00F0FF] text-black font-bold px-4 py-2 text-sm uppercase tracking-widest hover:bg-white disabled:opacity-50"
            >
              {myPred ? "Update" : "Save"}
            </button>
            {myPred && (
              <CheckCircle size={20} className="text-[#39FF14]" weight="fill" />
            )}
          </div>
        )}
        {err && <div className="text-[#FF3B30] text-xs mt-2">{err}</div>}
      </div>

      {/* See others */}
      <div className="mt-2">
        <button
          data-testid={`see-others-${match.id}`}
          onClick={loadOthers}
          className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white inline-flex items-center gap-1"
        >
          <EyeSlash size={14} /> See other picks
        </button>
        {othersOpen && others && (
          <div className="mt-2 border border-white/10 p-3 text-sm">
            {others.locked ? (
              <div className="text-zinc-500">Hidden until kick-off.</div>
            ) : others.predictions.length === 0 ? (
              <div className="text-zinc-500">No predictions submitted.</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {others.predictions.map((p) => (
                  <li key={p.id} className="flex justify-between py-1">
                    <span className="text-zinc-300">{p.user?.name || "Player"}</span>
                    <span className="font-mono text-[#00F0FF]">{p.home_score} : {p.away_score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [myPreds, setMyPreds] = useState({});
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const [m, p] = await Promise.all([api.get("/matches"), api.get("/predictions/me")]);
    setMatches(m.data);
    const map = {};
    p.data.forEach((x) => (map[x.match_id] = x));
    setMyPreds(map);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (match_id, home_score, away_score) => {
    const { data } = await api.post("/predictions", { match_id, home_score, away_score });
    setMyPreds((prev) => ({ ...prev, [match_id]: data }));
  };

  const filtered = matches.filter((m) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return m.status !== "finished";
    if (filter === "finished") return m.status === "finished";
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="label-eyebrow">Live Match Scoring</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Matches</h1>
        <p className="text-zinc-500 text-sm mt-1">Predict 3 pts (winner) + 2 (goal diff) + 5 (exact). Max 10 / match.</p>
      </div>

      <div className="flex gap-2">
        {["all", "upcoming", "finished"].map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold border transition-all ${
              filter === f
                ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="surface p-6 text-zinc-500 text-sm text-center">No matches.</div>
        )}
        {filtered.map((m) => (
          <MatchRow key={m.id} match={m} myPred={myPreds[m.id]} onSubmit={onSubmit} />
        ))}
      </div>
    </div>
  );
}
