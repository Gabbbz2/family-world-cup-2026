import React, { useEffect, useMemo, useState } from "react";
import { api, formatError } from "../lib/api";
import { FlagTeam, Flag } from "../components/FlagTeam";
import { Crown, Strategy as StrategyIcon, Star, Lightning, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { fmtSwedishCompact } from "../lib/dates";

const VERSIONS = [
  { v: 1, label: "Version 1", mult: 1.0, hint: "Max poäng (100 %)", color: "#00F0FF" },
  { v: 2, label: "Version 2", mult: 0.75, hint: "75 % multiplikator", color: "#39FF14" },
  { v: 3, label: "Version 3", mult: 0.50, hint: "50 % multiplikator", color: "#FFCC00" },
  { v: 4, label: "Version 4", mult: 0.25, hint: "25 % multiplikator", color: "#FF3B30" },
];

function GroupRankingBox({ group, teams, ranking, onChange }) {
  // ranking is an array of 4 team_ids; ranking[i] === team_id at position i+1
  const pickedSet = new Set(ranking.filter(Boolean));
  const setPosition = (pos, teamId) => {
    const next = [...ranking];
    // Remove this teamId from any other position first
    for (let i = 0; i < 4; i++) if (next[i] === teamId) next[i] = "";
    next[pos] = teamId;
    onChange(next);
  };
  const positionLabels = ["1:a", "2:a", "3:e", "4:e"];
  const positionColors = ["#FFCC00", "#A1A1AA", "#FF8A3D", "#FF3B30"];
  return (
    <div className="surface p-3" data-testid={`group-${group}`}>
      <div className="label-eyebrow mb-3">Grupp {group}</div>
      <div className="space-y-2">
        {positionLabels.map((label, idx) => {
          const currentId = ranking[idx] || "";
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-8 text-center font-display font-black text-sm" style={{ color: positionColors[idx] }}>
                {label}
              </div>
              <select
                data-testid={`rank-${group}-${idx + 1}`}
                value={currentId}
                onChange={(e) => setPosition(idx, e.target.value)}
                className="flex-1 bg-[#0A0A0A] border border-white/10 px-2 py-2 text-sm text-white focus:border-[#00F0FF] outline-none"
              >
                <option value="">— Välj lag —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={pickedSet.has(t.id) && t.id !== currentId}>
                    {t.team_name}
                  </option>
                ))}
              </select>
              {currentId && (() => {
                const t = teams.find((x) => x.id === currentId);
                return t ? <Flag code={t.country_code} size={20} /> : null;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamMultiPick({ teams, selected, onToggle, testidPrefix, limit = null }) {
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
      {teams.map((t) => {
        const isSel = selected.includes(t.id);
        const disabled = !isSel && limit && selected.length >= limit;
        return (
          <button
            key={t.id}
            data-testid={`${testidPrefix}-${t.id}`}
            onClick={() => onToggle(t.id)}
            disabled={disabled}
            className={`w-full flex items-center gap-2 px-2 py-2 border transition-all text-left ${
              isSel
                ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white"
                : disabled ? "border-white/5 text-zinc-700 cursor-not-allowed"
                : "border-white/10 text-zinc-300 hover:border-white/30"
            }`}
          >
            <Flag code={t.country_code} size={20} />
            <span className="text-sm font-semibold truncate">{t.team_name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TournamentPrediction() {
  const [groups, setGroups] = useState({});
  const [version, setVersion] = useState(1);
  const [deadline, setDeadline] = useState(null);
  const [pred, setPred] = useState({
    group_rankings: {}, advancing: [], r32: [], r16: [], qf: [], sf: [], finalists: [], champion: "",
  });
  const [existing, setExisting] = useState({});
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");

  const allTeams = useMemo(() => Object.values(groups).flat(), [groups]);
  const tmap = useMemo(() => {
    const m = {};
    allTeams.forEach((t) => (m[t.id] = t));
    return m;
  }, [allTeams]);

  useEffect(() => {
    (async () => {
      const [g, mine, dl] = await Promise.all([
        api.get("/teams/groups"),
        api.get("/tournament-predictions/me"),
        api.get("/config/v1-deadline").catch(() => ({ data: {} })),
      ]);
      setGroups(g.data);
      const map = {};
      mine.data.forEach((p) => (map[p.version] = p));
      setExisting(map);
      setDeadline(dl.data?.deadline || null);
    })();
  }, []);

  useEffect(() => {
    const e = existing[version];
    if (e) {
      setPred({
        group_rankings: e.group_rankings || {},
        advancing: e.advancing || [],
        r32: e.r32 || [], r16: e.r16 || [], qf: e.qf || [],
        sf: e.sf || [], finalists: e.finalists || [], champion: e.champion || "",
      });
    } else {
      setPred({ group_rankings: {}, advancing: [], r32: [], r16: [], qf: [], sf: [], finalists: [], champion: "" });
    }
  }, [version, existing]);

  const setGroupRanking = (g, arr) => {
    setPred((p) => ({ ...p, group_rankings: { ...p.group_rankings, [g]: arr } }));
  };
  const toggleList = (key, teamId) => {
    setPred((p) => {
      const arr = p[key].includes(teamId) ? p[key].filter((x) => x !== teamId) : [...p[key], teamId];
      return { ...p, [key]: arr };
    });
  };

  const submit = async () => {
    setErr(""); setSaved("");
    try {
      const payload = { version, ...pred };
      const { data } = await api.post("/tournament-predictions", payload);
      setExisting((prev) => ({ ...prev, [version]: data }));
      setSaved(`Version ${version} sparad`);
    } catch (e) {
      setErr(formatError(e));
    }
  };

  const currentMult = VERSIONS.find((v) => v.v === version)?.mult || 1;
  const deadlinePassed = deadline && new Date(deadline) < new Date();

  return (
    <div className="space-y-6">
      <div>
        <div className="label-eyebrow">Strategi · Turneringstips</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Turneringstips</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Strategipoäng: Gruppvinnare +5 · Vidare från grupp +3 · Åttondelsfinal +4 · Sextondelsfinal +6 · Kvartsfinal +8 · Semifinal +12 · Final +20 · Mästare +30.
        </p>
        {version === 1 && deadline && (
          deadlinePassed ? (
            <div className="mt-2 text-xs px-3 py-2 border border-white/10 text-zinc-400" data-testid="v1-closed-banner">
              Version 1 är stängd.
            </div>
          ) : (
            <div className="mt-2 text-xs px-3 py-2 border border-[#FFCC00] text-[#FFCC00]" data-testid="v1-open-banner">
              <span className="font-bold uppercase tracking-widest">Version 1 stänger:</span> {fmtSwedishCompact(deadline)} (Europe/Stockholm)
            </div>
          )
        )}
      </div>

      {/* Version selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {VERSIONS.map((v) => (
          <button
            key={v.v}
            data-testid={`version-${v.v}`}
            onClick={() => setVersion(v.v)}
            className={`p-3 border text-left transition-all ${
              version === v.v ? "border-[#00F0FF] bg-[#00F0FF]/10" : "border-white/10 hover:border-white/30"
            }`}
          >
            <div className="label-eyebrow" style={{ color: v.color }}>{v.label}</div>
            <div className="text-xs text-zinc-400 mt-1">{v.hint}</div>
            {existing[v.v] && (
              <div className="text-[10px] uppercase tracking-widest text-[#39FF14] mt-2">Sparad</div>
            )}
          </button>
        ))}
      </div>

      <div className="surface p-3 text-xs text-zinc-400 flex items-center gap-2">
        <Lightning size={16} className="text-[#00F0FF]" weight="fill" />
        Aktuell multiplikator: <span className="text-white font-bold">{Math.round(currentMult * 100)} %</span>
      </div>

      {/* Group rankings 1st-4th */}
      <section>
        <h2 className="font-display font-bold text-xl mb-3 flex items-center gap-2">
          <StrategyIcon size={20} weight="fill" className="text-[#00F0FF]" /> Gruppspel — placering 1 till 4
        </h2>
        <p className="text-zinc-500 text-xs mb-3">Varje lag kan bara väljas en gång per grupp.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.keys(groups).sort().map((g) => (
            <GroupRankingBox
              key={g}
              group={g}
              teams={groups[g]}
              ranking={pred.group_rankings[g] || ["", "", "", ""]}
              onChange={(arr) => setGroupRanking(g, arr)}
            />
          ))}
        </div>
      </section>

      {/* Bracket stages */}
      <section>
        <h2 className="font-display font-bold text-xl mb-3">Slutspelsträd</h2>
        <p className="text-zinc-500 text-xs mb-3">Välj lagen som går vidare i varje omgång. Tryck för att markera.</p>
        <div className="overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-6 gap-3 min-w-[900px]">
            {[
              { key: "advancing", label: "Vidare från grupp", color: "#A1A1AA", limit: 32 },
              { key: "r16", label: "Åttondelsfinal", color: "#00F0FF", limit: 16 },
              { key: "qf", label: "Kvartsfinal", color: "#39FF14", limit: 8 },
              { key: "sf", label: "Semifinal", color: "#FFCC00", limit: 4 },
              { key: "finalists", label: "Finalister", color: "#FF3B30", limit: 2 },
              { key: "champion", label: "Mästare", color: "#FFFFFF" },
            ].map((stage) => (
              <div key={stage.key} className="surface p-3" data-testid={`stage-${stage.key}`}>
                <div className="label-eyebrow mb-2" style={{ color: stage.color }}>{stage.label}</div>
                {stage.key === "champion" ? (
                  <div>
                    <select
                      data-testid="champion-pick"
                      value={pred.champion || ""}
                      onChange={(e) => setPred((p) => ({ ...p, champion: e.target.value }))}
                      className="w-full bg-[#0A0A0A] border border-white/10 px-2 py-2 text-sm text-white focus:border-[#00F0FF] outline-none"
                    >
                      <option value="">Välj mästare</option>
                      {allTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                    {pred.champion && tmap[pred.champion] && (
                      <div className="mt-3 p-3 border border-[#00F0FF] bg-[#00F0FF]/10 flex items-center gap-2">
                        <Crown size={20} weight="fill" className="text-[#FFCC00]" />
                        <FlagTeam team={tmap[pred.champion]} size={20} />
                      </div>
                    )}
                  </div>
                ) : (
                  <TeamMultiPick
                    teams={allTeams}
                    selected={pred[stage.key]}
                    onToggle={(id) => toggleList(stage.key, id)}
                    testidPrefix={stage.key}
                    limit={stage.limit}
                  />
                )}
                <div className="mt-2 text-[10px] text-zinc-500">
                  Valda: {stage.key === "champion" ? (pred.champion ? 1 : 0) : pred[stage.key].length}{stage.limit ? ` / ${stage.limit}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {err && <div className="text-[#FF3B30] text-sm">{err}</div>}
      {saved && <div className="text-[#39FF14] text-sm" data-testid="save-feedback">{saved}</div>}

      <div className="sticky bottom-20 z-20">
        <button
          data-testid="submit-tournament-prediction"
          onClick={submit}
          className="w-full bg-[#00F0FF] text-black font-bold uppercase tracking-widest py-4 hover:bg-white transition-all"
        >
          <span className="inline-flex items-center gap-2"><Star size={20} weight="fill" /> Spara Version {version}</span>
        </button>
      </div>
    </div>
  );
}
