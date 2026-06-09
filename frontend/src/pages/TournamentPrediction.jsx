import React, { useEffect, useMemo, useState } from "react";
import { api, formatError } from "../lib/api";
import { FlagTeam, Flag } from "../components/FlagTeam";
import { Crown, Strategy as StrategyIcon, Star, Lightning } from "@phosphor-icons/react";

const VERSIONS = [
  { v: 1, label: "Version 1", mult: 1.0, hint: "Most points (100%)", color: "#00F0FF" },
  { v: 2, label: "Version 2", mult: 0.75, hint: "75% multiplier", color: "#39FF14" },
  { v: 3, label: "Version 3", mult: 0.50, hint: "50% multiplier", color: "#FFCC00" },
  { v: 4, label: "Version 4", mult: 0.25, hint: "25% multiplier", color: "#FF3B30" },
];

function TeamPick({ team, selected, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-2 border transition-all text-left ${
        selected
          ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white"
          : "border-white/10 text-zinc-300 hover:border-white/30"
      }`}
    >
      <Flag code={team.country_code} size={20} />
      <span className="text-sm font-semibold truncate">{team.team_name}</span>
    </button>
  );
}

function TeamSelect({ teams, value, onChange, placeholder, testid }) {
  return (
    <select
      data-testid={testid}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#0A0A0A] border border-white/10 px-2 py-2 text-sm text-white focus:border-[#00F0FF] outline-none"
    >
      <option value="">{placeholder}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.team_name}</option>
      ))}
    </select>
  );
}

export default function TournamentPrediction() {
  const [groups, setGroups] = useState({});
  const [version, setVersion] = useState(1);
  const [pred, setPred] = useState({
    group_winners: {}, group_runners_up: {},
    r32: [], r16: [], qf: [], sf: [], finalists: [], champion: "",
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
      const [g, mine] = await Promise.all([
        api.get("/teams/groups"),
        api.get("/tournament-predictions/me"),
      ]);
      setGroups(g.data);
      const map = {};
      mine.data.forEach((p) => (map[p.version] = p));
      setExisting(map);
    })();
  }, []);

  // Load existing into form when version changes
  useEffect(() => {
    const e = existing[version];
    if (e) {
      setPred({
        group_winners: e.group_winners || {},
        group_runners_up: e.group_runners_up || {},
        r32: e.r32 || [], r16: e.r16 || [], qf: e.qf || [],
        sf: e.sf || [], finalists: e.finalists || [], champion: e.champion || "",
      });
    } else {
      setPred({ group_winners: {}, group_runners_up: {}, r32: [], r16: [], qf: [], sf: [], finalists: [], champion: "" });
    }
  }, [version, existing]);

  const toggleList = (key, teamId) => {
    setPred((p) => {
      const arr = p[key].includes(teamId) ? p[key].filter((x) => x !== teamId) : [...p[key], teamId];
      return { ...p, [key]: arr };
    });
  };

  const submit = async () => {
    setErr(""); setSaved("");
    try {
      const { data } = await api.post("/tournament-predictions", { version, ...pred });
      setExisting((prev) => ({ ...prev, [version]: data }));
      setSaved(`Version ${version} saved` + (data.is_late ? " (LATE — flagged)" : ""));
    } catch (e) {
      setErr(formatError(e));
    }
  };

  const advancingPool = useMemo(() => {
    // 24 teams: 12 group winners + 12 runners-up + 8 best thirds (we let user pick from all teams for r32)
    return allTeams;
  }, [allTeams]);

  const currentMult = VERSIONS.find((v) => v.v === version)?.mult || 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="label-eyebrow">Strategy / Tournament Picks</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Tournament Prediction</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Earn strategy points: Group winner +5 · Advancing +3 · R32 +4 · R16 +6 · QF +8 · SF +12 · Final +20 · Champion +30.
        </p>
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
              <div className="text-[10px] uppercase tracking-widest text-[#39FF14] mt-2">Saved {existing[v.v].is_late ? "· LATE" : ""}</div>
            )}
          </button>
        ))}
      </div>

      <div className="surface p-3 text-xs text-zinc-400 flex items-center gap-2">
        <Lightning size={16} className="text-[#00F0FF]" weight="fill" />
        Current multiplier: <span className="text-white font-bold">{Math.round(currentMult * 100)}%</span>
      </div>

      {/* Group stage picks */}
      <section>
        <h2 className="font-display font-bold text-xl mb-3 flex items-center gap-2">
          <StrategyIcon size={20} weight="fill" className="text-[#00F0FF]" /> Group Stage
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.keys(groups).sort().map((g) => (
            <div key={g} className="surface p-3" data-testid={`group-${g}`}>
              <div className="label-eyebrow mb-2">Group {g}</div>
              <div className="space-y-2 mb-3">
                {groups[g].map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <Flag code={t.country_code} size={18} />
                    <span className="truncate flex-1">{t.team_name}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#FFCC00] mb-1">Winner</div>
                  <TeamSelect
                    testid={`winner-${g}`}
                    teams={groups[g]}
                    value={pred.group_winners[g]}
                    onChange={(id) => setPred((p) => ({ ...p, group_winners: { ...p.group_winners, [g]: id } }))}
                    placeholder="Pick winner"
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Runner-up</div>
                  <TeamSelect
                    testid={`runnerup-${g}`}
                    teams={groups[g]}
                    value={pred.group_runners_up[g]}
                    onChange={(id) => setPred((p) => ({ ...p, group_runners_up: { ...p.group_runners_up, [g]: id } }))}
                    placeholder="Pick runner-up"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bracket stages */}
      <section>
        <h2 className="font-display font-bold text-xl mb-3">Knockout Bracket</h2>
        <div className="overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-6 gap-3 min-w-[900px]">
            {[
              { key: "r32", label: "Round of 32", color: "#A1A1AA" },
              { key: "r16", label: "Round of 16", color: "#00F0FF" },
              { key: "qf", label: "Quarter-finals", color: "#39FF14" },
              { key: "sf", label: "Semi-finals", color: "#FFCC00" },
              { key: "finalists", label: "Finalists", color: "#FF3B30" },
              { key: "champion", label: "Champion", color: "#FFFFFF" },
            ].map((stage) => (
              <div key={stage.key} className="surface p-3" data-testid={`stage-${stage.key}`}>
                <div className="label-eyebrow mb-2" style={{ color: stage.color }}>{stage.label}</div>
                {stage.key === "champion" ? (
                  <div>
                    <TeamSelect
                      testid="champion-pick"
                      teams={allTeams}
                      value={pred.champion}
                      onChange={(id) => setPred((p) => ({ ...p, champion: id }))}
                      placeholder="Pick champion"
                    />
                    {pred.champion && tmap[pred.champion] && (
                      <div className="mt-3 p-3 border border-[#00F0FF] bg-[#00F0FF]/10 flex items-center gap-2">
                        <Crown size={20} weight="fill" className="text-[#FFCC00]" />
                        <FlagTeam team={tmap[pred.champion]} size={20} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {advancingPool.map((t) => (
                      <TeamPick
                        key={t.id}
                        testid={`${stage.key}-${t.id}`}
                        team={t}
                        selected={pred[stage.key].includes(t.id)}
                        onClick={() => toggleList(stage.key, t.id)}
                      />
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-zinc-500">
                  Picked: {stage.key === "champion" ? (pred.champion ? 1 : 0) : pred[stage.key].length}
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
          <span className="inline-flex items-center gap-2"><Star size={20} weight="fill" /> Save Version {version} Predictions</span>
        </button>
      </div>
    </div>
  );
}
