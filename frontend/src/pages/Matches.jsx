import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { FlagTeam } from "../components/FlagTeam";
import { LockKey, CheckCircle, EyeSlash, Clock, Television } from "@phosphor-icons/react";
import { fmtSwedishDateLong, fmtSwedishTime } from "../lib/dates";
import { useCountdown } from "../lib/countdown";

const LOCK_OFFSET_MS = 5 * 60 * 1000; // Predictions lock 5 minutes before kickoff

function fmtKickoff(iso) {
  if (!iso) return "";
  return `${fmtSwedishDateLong(iso)} · ${fmtSwedishTime(iso)}`;
}

function MatchRow({ match, myPred, onSubmit }) {
  const kickoffMs = new Date(match.kickoff).getTime();
  const lockMs = kickoffMs - LOCK_OFFSET_MS;
  const lockIso = new Date(lockMs).toISOString();
  const nowMs = Date.now();
  const locked = nowMs >= lockMs;
  const countdown = useCountdown(locked ? null : lockIso);
  const finished = match.status === "finished" && match.home_score !== null && match.away_score !== null;
  const hasTeams = match.home_team && match.away_team;
  const [h, setH] = useState(myPred?.home_score ?? "");
  const [a, setA] = useState(myPred?.away_score ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [othersOpen, setOthersOpen] = useState(false);
  const [others, setOthers] = useState(null);

  let homeWon = false, awayWon = false;
  if (finished) {
    if (match.home_score > match.away_score) homeWon = true;
    else if (match.away_score > match.home_score) awayWon = true;
  }

  const submit = async () => {
    setErr(""); setBusy(true);
    try { await onSubmit(match.id, parseInt(h), parseInt(a)); }
    catch (e) { setErr(formatError(e)); }
    finally { setBusy(false); }
  };

  const loadOthers = async () => {
    setOthersOpen(true);
    if (!others) {
      try { const { data } = await api.get(`/predictions/match/${match.id}`); setOthers(data); }
      catch { setOthers({ locked: true, predictions: [] }); }
    }
  };

  return (
    <div className="surface p-4" data-testid={`match-card-${match.id}`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {match.match_number && (
            <span className="bg-[#1C1C1C] border border-white/10 text-zinc-400 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
              #{match.match_number}
            </span>
          )}
          <span className="label-eyebrow">
            {match.round || (match.stage === "Group Stage" || match.stage === "group" ? `Grupp ${match.group}` : match.stage)}
          </span>
          {match.group && match.round && (
            <span className="label-eyebrow text-[#00F0FF]">Grupp {match.group}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {match.tv_channel && (
            <span className="text-[10px] uppercase tracking-widest text-[#FFCC00] inline-flex items-center gap-1">
              <Television size={12} weight="fill" /> {match.tv_channel}
            </span>
          )}
          <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
            <Clock size={14} /> {fmtKickoff(match.kickoff)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 items-center gap-2">
        <div className={`col-span-3 ${homeWon ? "" : awayWon ? "opacity-50" : ""}`}>
          <FlagTeam team={match.home_team} placeholder={match.home_placeholder} size={22} dim={awayWon && finished} />
        </div>
        <div className="col-span-1 text-center">
          {finished ? (
            <div className="font-display font-black text-2xl text-[#39FF14]" data-testid={`score-${match.id}`}>
              {match.home_score} : {match.away_score}
            </div>
          ) : (
            <span className="label-eyebrow text-zinc-500">vs</span>
          )}
        </div>
        <div className={`col-span-3 flex justify-end ${awayWon ? "" : homeWon ? "opacity-50" : ""}`}>
          <FlagTeam team={match.away_team} placeholder={match.away_placeholder} size={22} reverse dim={homeWon && finished} />
        </div>
      </div>

      {/* Prediction */}
      <div className="mt-4 border-t border-white/10 pt-3">
        {!hasTeams ? (
          <div className="text-sm text-zinc-500">Lagen är inte fastställda — tippning öppnar när platshållarna är lösta.</div>
        ) : locked ? (
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-zinc-400 inline-flex items-center gap-1" data-testid={`locked-${match.id}`}>
              <LockKey size={14} /> Tippning stängd
            </span>
            {myPred ? (
              <span className="text-[#00F0FF] font-mono" data-testid={`my-pick-${match.id}`}>
                Ditt tips: <strong>{myPred.home_score} : {myPred.away_score}</strong>
              </span>
            ) : (
              <span className="text-zinc-600 text-xs">Inget tips inskickat</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <input data-testid={`pred-home-${match.id}`} type="number" min={0} max={20}
              value={h} onChange={(e) => setH(e.target.value)}
              className="w-14 bg-[#0A0A0A] border border-white/10 text-center py-2 focus:border-[#00F0FF]" placeholder="0" />
            <span className="text-zinc-500">:</span>
            <input data-testid={`pred-away-${match.id}`} type="number" min={0} max={20}
              value={a} onChange={(e) => setA(e.target.value)}
              className="w-14 bg-[#0A0A0A] border border-white/10 text-center py-2 focus:border-[#00F0FF]" placeholder="0" />
            <button data-testid={`pred-save-${match.id}`} onClick={submit} disabled={busy || h === "" || a === ""}
              className="ml-auto bg-[#00F0FF] text-black font-bold px-4 py-2 text-sm uppercase tracking-widest hover:bg-white disabled:opacity-50">
              {myPred ? "Uppdatera" : "Spara"}
            </button>
            {myPred && <CheckCircle size={20} className="text-[#39FF14]" weight="fill" />}
          </div>
        )}
        {!locked && (
          <div className="text-[10px] text-zinc-600 mt-2 uppercase tracking-widest" data-testid={`countdown-${match.id}`}>
            {countdown ? countdown : "Tippning stänger 5 minuter före avspark"}
          </div>
        )}
        {err && <div className="text-[#FF3B30] text-xs mt-2">{err}</div>}
      </div>

      {hasTeams && (
        <div className="mt-2">
          <button data-testid={`see-others-${match.id}`} onClick={loadOthers}
            className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white inline-flex items-center gap-1">
            <EyeSlash size={14} /> Se andras tips
          </button>
          {othersOpen && others && (
            <div className="mt-2 border border-white/10 p-3 text-sm">
              {others.locked ? <div className="text-zinc-500">Andras tips visas när matchen är slut.</div>
                : others.predictions.length === 0 ? <div className="text-zinc-500">Inga tips inskickade.</div>
                : (
                  <ul className="divide-y divide-white/5">
                    {others.predictions.map((p) => (
                      <li key={p.id} className="flex justify-between py-1">
                        <span className="text-zinc-300">{p.user?.name || "Spelare"}</span>
                        <span className="font-mono text-[#00F0FF]">{p.home_score} : {p.away_score}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [myPreds, setMyPreds] = useState({});
  const [filter, setFilter] = useState("upcoming");
  const [stageFilter, setStageFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [swedenOnly, setSwedenOnly] = useState(false);

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

  const groupOptions = Array.from(new Set(matches.map((m) => m.group).filter(Boolean))).sort();
  const channelOptions = Array.from(new Set(matches.map((m) => m.tv_channel).filter(Boolean))).sort();

  const filtered = matches.filter((m) => {
    if (filter === "upcoming" && m.status === "finished") return false;
    if (filter === "finished" && m.status !== "finished") return false;
    if (stageFilter !== "all") {
      if (stageFilter === "group" && m.stage !== "Group Stage") return false;
      if (stageFilter === "knockout" && m.stage !== "Knockout") return false;
    }
    if (groupFilter !== "all" && m.group !== groupFilter) return false;
    if (channelFilter !== "all" && m.tv_channel !== channelFilter) return false;
    if (swedenOnly) {
      const home = (m.home_team?.team_name || "").toLowerCase();
      const away = (m.away_team?.team_name || "").toLowerCase();
      if (!home.includes("sverige") && !away.includes("sverige")) return false;
    }
    return true;
  });

  const filterLabels = { upcoming: "Kommande", finished: "Spelade", all: "Alla" };
  const stageLabels = { all: "Alla matcher", group: "Gruppspel", knockout: "Slutspel" };

  return (
    <div className="space-y-4">
      <div>
        <div className="label-eyebrow">Livetippning</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Matcher</h1>
        <p className="text-zinc-500 text-sm mt-1">Tippa 3 (vinnare) + 2 (målskillnad) + 5 (exakt) = max 10 p/match. Tippningen stänger 5 minuter före avspark.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.keys(filterLabels).map((f) => (
          <button key={f} data-testid={`filter-${f}`} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold border transition-all ${
              filter === f ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 text-zinc-400 hover:text-white"
            }`}>{filterLabels[f]}</button>
        ))}
        <span className="mx-2 text-zinc-700">|</span>
        {Object.keys(stageLabels).map((s) => (
          <button key={s} data-testid={`stagefilter-${s}`} onClick={() => setStageFilter(s)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold border transition-all ${
              stageFilter === s ? "bg-[#39FF14] text-black border-[#39FF14]" : "border-white/10 text-zinc-400 hover:text-white"
            }`}>{stageLabels[s]}</button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
          className="bg-[#0A0A0A] border border-white/10 text-sm text-white px-3 py-2 min-w-[180px]">
          <option value="all">Alla grupper</option>
          {groupOptions.map((g) => <option key={g} value={g}>{`Grupp ${g}`}</option>)}
        </select>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
          className="bg-[#0A0A0A] border border-white/10 text-sm text-white px-3 py-2 min-w-[180px]">
          <option value="all">Alla kanaler</option>
          {channelOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button data-testid="filter-sweden" onClick={() => setSwedenOnly((v) => !v)}
          className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold border transition-all ${
            swedenOnly ? "bg-[#FFCC00] text-black border-[#FFCC00]" : "border-white/10 text-zinc-400 hover:text-white"
          }`}>
          {swedenOnly ? "Endast Sverige" : "Visa Sverige"}
        </button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="surface p-6 text-zinc-500 text-sm text-center">Inga matcher.</div>}
        {filtered.map((m) => <MatchRow key={m.id} match={m} myPred={myPreds[m.id]} onSubmit={onSubmit} />)}
      </div>
    </div>
  );
}
