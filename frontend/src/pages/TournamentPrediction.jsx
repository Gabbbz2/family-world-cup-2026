import React, { useEffect, useMemo, useState } from "react";
import { api, formatError } from "../lib/api";
import { FlagTeam, Flag } from "../components/FlagTeam";
import { Crown, Strategy as StrategyIcon, Star, Lightning, Television } from "@phosphor-icons/react";
import { fmtSwedishCompact, fmtSwedishDateLong, fmtSwedishTime } from "../lib/dates";
import { useCountdown, isPast } from "../lib/countdown";

function GroupRankingBox({ group, teams, ranking, onChange, disabled }) {
  const setPosition = (pos, teamId) => {
    const next = [...ranking];
    for (let i = 0; i < 4; i++) if (next[i] === teamId) next[i] = "";
    next[pos] = teamId;
    onChange(next);
  };
  const labels = ["1:a", "2:a", "3:e", "4:e"];
  const colors = ["#FFCC00", "#A1A1AA", "#FF8A3D", "#FF3B30"];
  return (
    <div className="surface p-3" data-testid={`group-${group}`}>
      <div className="label-eyebrow mb-3">Grupp {group}</div>
      <div className="space-y-2">
        {labels.map((label, idx) => {
          const currentId = ranking[idx] || "";
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-8 text-center font-display font-black text-sm" style={{ color: colors[idx] }}>{label}</div>
              <select
                data-testid={`rank-${group}-${idx + 1}`}
                value={currentId}
                disabled={disabled}
                onChange={(e) => setPosition(idx, e.target.value)}
                className="flex-1 bg-[#0A0A0A] border border-white/10 px-2 py-2 text-sm text-white focus:border-[#00F0FF] outline-none disabled:opacity-50"
              >
                <option value="">— Välj lag —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} disabled={ranking.includes(t.id) && t.id !== currentId}>
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

function TeamMultiPick({ teams, selected, onToggle, testidPrefix, limit, disabled, highlightIds = [] }) {
  const sortedTeams = [...teams].sort((a, b) => a.team_name?.localeCompare(b.team_name, "sv") || 0);
  const highlightSet = new Set(highlightIds || []);
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
      {sortedTeams.map((t) => {
        const isSel = selected.includes(t.id);
        const disabledNow = disabled || (!isSel && limit && selected.length >= limit);
        const isHighlightedCorrect = isSel && highlightSet.has(t.id);
        return (
          <button
            key={t.id}
            data-testid={`${testidPrefix}-${t.id}`}
            onClick={() => onToggle(t.id)}
            disabled={disabledNow}
            className={`w-full min-w-[220px] flex items-center gap-2 px-3 py-2 border transition-all text-left ${
              isHighlightedCorrect ? "border-[#FFCC00] bg-[#FFCC00]/20 text-[#FFCC00]"
                : isSel ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white"
                : disabledNow ? "border-white/5 text-zinc-700 cursor-not-allowed"
                : "border-white/10 text-zinc-300 hover:border-white/30"
            }`}
          >
            <Flag code={t.country_code} size={20} />
            <span className="text-sm font-semibold whitespace-normal">{t.team_name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============ Dynamic Bracket editor (progressive bracket after each stage) ============
function DynamicBracketEditor({ afterStage, allTeams, tmap, pred, setPred, locked, versionId }) {
  const [remainingTeams, setRemainingTeams] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    const fetch = async () => {
      setLoading(true); setErr("");
      try {
        const res = await api.get(`/strategy/remaining-teams/${afterStage}`);
        setRemainingTeams(res || {});
      } catch (e) {
        setErr(formatError(e));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [afterStage]);

  const toggleList = (key, teamId) =>
    setPred((p) => {
      if (key === "champion") {
        return { ...p, champion: p.champion === teamId ? "" : teamId };
      }
      const arr = p[key].includes(teamId) ? p[key].filter((x) => x !== teamId) : [...p[key], teamId];
      return { ...p, [key]: arr };
    });

  if (loading) return <div className="surface p-6 text-center text-zinc-500">Laddar återstående lag...</div>;
  if (err) return <div className="surface p-6 text-[#FF3B30]">{err}</div>;

  // Map of stages in order
  const stageMap = [
    { key: "r16", label: "Åttondelsfinal", color: "#00F0FF", limit: 16 },
    { key: "qf", label: "Kvartsfinal", color: "#39FF14", limit: 8 },
    { key: "sf", label: "Semifinal", color: "#FFCC00", limit: 4 },
    { key: "third_place", label: "Bronsmatch", color: "#FF8A3D", limit: 2 },
    { key: "final", label: "Final", color: "#FF3B30", limit: 2 },
    { key: "champion", label: "Mästare", color: "#FFFFFF", limit: 1 },
  ];

  // Filter to stages that have remaining teams; always include champion when the final is present.
  const visibleStages = stageMap.filter((s) => {
    if (s.key === "champion") {
      return Boolean(remainingTeams.final?.length || remainingTeams.champion?.length);
    }
    return Boolean(remainingTeams[s.key]?.length);
  });
  if (visibleStages.length === 0) {
    return <div className="surface p-6 text-center text-zinc-500">Ingen data tillgänglig ännu. Vänta på att omgången slutförs.</div>;
  }

  const stageLabels = {
    group: "gruppspel",
    r32: "sextondelsfinal",
    r16: "åttondelsfinal",
    qf: "kvartsfinal",
    sf: "semifinal",
    third_place: "bronsmatch",
  };
  const afterLabel = stageLabels[afterStage] || afterStage;

  const handleBracketKeyboard = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const node = e.currentTarget;
      node.scrollBy({ left: e.key === "ArrowLeft" ? -220 : 220, behavior: "smooth" });
      e.preventDefault();
    }
  };

  return (
    <>
      <section>
        <h2 className="font-display font-bold text-xl mb-3">Återstående slutspelsträd</h2>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Efter {afterLabel}</div>
        <p className="text-zinc-500 text-xs mb-3">
          Endast lag som fortfarande är i turneringen visas för de kommande omgångarna.
        </p>
      </section>

      <div
        className="overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        tabIndex={0}
        onKeyDown={handleBracketKeyboard}
      >
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleStages.length}, minmax(200px, 1fr))`, gap: '12px', minWidth: `${visibleStages.length * 220}px` }}>
          {visibleStages.map((stage) => {
            const teamsForStage = stage.key === "champion"
              ? (remainingTeams.champion?.length ? remainingTeams.champion : remainingTeams.final || [])
              : remainingTeams[stage.key] || [];
            const selectedTeams = allTeams.filter((t) => teamsForStage.includes(t.id));
            const selected = stage.key === "champion" ? (pred.champion ? [pred.champion] : []) : (pred[stage.key] || []);
            return (
              <div key={stage.key} className="surface p-3" data-testid={`dynamic-stage-${stage.key}`}>
                <div className="label-eyebrow mb-2" style={{ color: stage.color }}>{stage.label}</div>
                <TeamMultiPick
                  teams={selectedTeams}
                  selected={selected}
                  onToggle={(id) => toggleList(stage.key, id)}
                  testidPrefix={`dynamic-${stage.key}`}
                  limit={stage.limit}
                  disabled={locked}
                />
                <div className="mt-2 text-[10px] text-zinc-500">
                  Valda: {stage.key === "champion" ? (pred.champion ? 1 : 0) : selected.length} / {stage.limit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ Pre Tournament editor (old V1 shape) ============
function PreTournamentEditor({
  groups,
  allTeams,
  tmap,
  pred,
  setPred,
  locked,
  confirmedAdvancing = [],
  confirmedR16 = [],
  confirmedQf = [],
  confirmedSf = [],
  confirmedFinalists = [],
  bronzeWinner = "",
  championWinner = "",
}) {
  const setGroupRanking = (g, arr) =>
    setPred((p) => ({ ...p, group_rankings: { ...p.group_rankings, [g]: arr } }));
  const toggleList = (key, teamId) =>
    setPred((p) => {
      const arr = p[key].includes(teamId) ? p[key].filter((x) => x !== teamId) : [...p[key], teamId];
      return { ...p, [key]: arr };
    });
  return (
    <>
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
              disabled={locked}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display font-bold text-xl mb-3">Slutspelsträd</h2>
        <p className="text-zinc-500 text-xs mb-3">Välj lagen som går vidare i varje omgång. Tryck för att markera.</p>
        <div
          className="overflow-x-auto no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              const node = e.currentTarget;
              node.scrollBy({ left: e.key === "ArrowLeft" ? -220 : 220, behavior: "smooth" });
              e.preventDefault();
            }
          }}
        >
          <div className="inline-flex gap-3 min-w-max">
            {[
              { key: "advancing", label: "Vidare från grupp", color: "#A1A1AA", limit: 32 },
              { key: "r16", label: "Åttondelsfinal", color: "#00F0FF", limit: 16 },
              { key: "qf", label: "Kvartsfinal", color: "#39FF14", limit: 8 },
              { key: "sf", label: "Semifinal", color: "#FFCC00", limit: 4 },
              { key: "third_place", label: "Bronsmatch", color: "#FF8A3D", limit: 2 },
              { key: "finalists", label: "Finalister", color: "#FF3B30", limit: 2 },
              { key: "champion", label: "Mästare", color: "#FFFFFF" },
            ].map((stage) => (
              <div key={stage.key} className="surface p-3 min-w-[250px] sm:min-w-[280px] shrink-0" data-testid={`stage-${stage.key}`}>
                <div className="label-eyebrow mb-2" style={{ color: stage.color }}>{stage.label}</div>
                {stage.key === "champion" ? (
                  <div>
                    <select
                      data-testid="champion-pick"
                      value={pred.champion || ""}
                      disabled={locked}
                      onChange={(e) => setPred((p) => ({ ...p, champion: e.target.value }))}
                      className="w-full bg-[#0A0A0A] border border-white/10 px-2 py-2 text-sm text-white focus:border-[#00F0FF] outline-none disabled:opacity-50"
                    >
                      <option value="">Välj mästare</option>
                      {[...allTeams].sort((a, b) => a.team_name?.localeCompare(b.team_name, "sv") || 0).map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                    </select>
                    {pred.champion && tmap[pred.champion] && (
                      <div className={`mt-3 p-3 flex items-center gap-2 ${
                        championWinner && pred.champion === championWinner
                          ? "border border-[#FFCC00] bg-[#FFCC00]/20 text-[#FFCC00]"
                          : "border border-[#00F0FF] bg-[#00F0FF]/10"
                      }`}>
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
                    disabled={locked}
                    highlightIds={
                      stage.key === "advancing" ? confirmedAdvancing
                        : stage.key === "r16" ? confirmedR16
                        : stage.key === "qf" ? confirmedQf
                        : stage.key === "sf" ? confirmedSf
                        : stage.key === "finalists" ? confirmedFinalists
                        : stage.key === "third_place" ? (bronzeWinner ? [bronzeWinner] : [])
                        : []
                    }
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
    </>
  );
}

// ============ Knockout-stage editor (winner per match) ============
function KnockoutVersionEditor({ matches, picks, setPicks, locked, versionId }) {
  const pickFor = (mid) => picks[mid] || "";
  const set = (mid, tid) => setPicks((p) => ({ ...p, [mid]: tid }));
  if (matches.length === 0) {
    return (
      <div className="surface p-6 text-center text-zinc-500 text-sm">
        Matcherna för denna omgång är ännu inte fastställda. Tippningen öppnar när slutspelsschemat är klart.
      </div>
    );
  }
  return (
    <section className="space-y-3">
      <p className="text-zinc-500 text-xs">Välj vinnaren av varje match. Inga målresultat — endast vinnare.</p>
      {matches.map((m) => {
        const homeOk = m.home_team;
        const awayOk = m.away_team;
        const ready = homeOk && awayOk;
        const current = pickFor(m.id);
        return (
          <div key={m.id} className="surface p-3" data-testid={`ko-match-${m.id}`}>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">
              <span>#{m.match_number} · {m.round}</span>
              <span>{fmtSwedishDateLong(m.kickoff)} · {fmtSwedishTime(m.kickoff)} {m.tv_channel && <span className="text-[#FFCC00]"> · {m.tv_channel}</span>}</span>
            </div>
            {!ready ? (
              <div className="text-xs text-zinc-500 py-3 text-center">
                <FlagTeam team={m.home_team} placeholder={m.home_placeholder} size={18} /> <span className="mx-2">vs</span> <FlagTeam team={m.away_team} placeholder={m.away_placeholder} size={18} reverse />
                <div className="mt-2 text-[10px] uppercase tracking-widest">Lagen bestäms när bracket uppdateras</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[m.home_team, m.away_team].map((t) => {
                  const sel = current === t.id;
                  return (
                    <button
                      key={t.id}
                      data-testid={`ko-pick-${m.id}-${t.id}`}
                      disabled={locked}
                      onClick={() => set(m.id, t.id)}
                      className={`flex items-center gap-2 px-3 py-3 border transition-all ${
                        sel ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white" :
                        "border-white/10 text-zinc-300 hover:border-white/30 disabled:opacity-50"
                      }`}
                    >
                      <Flag code={t.country_code} size={20} />
                      <span className="text-sm font-semibold truncate flex-1 text-left">{t.team_name}</span>
                      {sel && <span className="text-[10px] uppercase tracking-widest text-[#00F0FF]">Vinnare</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

const KNOCKOUT_STAGE_ORDER = ["r32", "r16", "qf", "sf", "third_place", "final"];
const STAGE_LABELS = {
  r32: "Sextondelsfinal",
  r16: "Åttondelsfinal",
  qf: "Kvartsfinal",
  sf: "Semifinal",
  third_place: "Bronsmatch",
  final: "Final",
};

function FullKnockoutTreeEditor({ tree, state, onPickWinner, onPickChampion, onPickBronze, locked, loading, err }) {
  if (loading) return <div className="surface p-6 text-center text-zinc-500">Laddar slutspelsträd...</div>;
  if (err) return <div className="surface p-6 text-[#FF3B30]">{err}</div>;
  if (!tree) return null;
  if (!tree.starting_matches_exist) {
    return (
      <div className="surface p-6 text-center text-zinc-500 text-sm">
        Matcherna för startomgången är ännu inte fastställda.
      </div>
    );
  }

  const included = tree.included_rounds || [];
  const shouldShowChampion = included.includes("final") || tree.version === "final";
  const shouldShowBronze = included.includes("third_place") || tree.version === "third_place";

  return (
    <section className="space-y-3">
      {tree.has_duplicate_teams && (
        <div className="surface p-3 border border-[#FFCC00] text-[#FFCC00] text-xs">
          Varning: dubbletter hittades i genererat slutspelsträd.
        </div>
      )}
      <div
        className="overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
        tabIndex={0}
      >
        <div className="inline-flex gap-3 min-w-max">
          {included.map((stage) => {
            const rows = tree.generated_matches?.[stage] || [];
            return (
              <div key={stage} className="surface p-3 min-w-[280px] shrink-0" data-testid={`tree-stage-${stage}`}>
                <div className="label-eyebrow mb-2">{STAGE_LABELS[stage] || stage}</div>
                <div className="space-y-2">
                  {rows.map((m) => {
                    const selected = state?.picks?.[stage]?.[m.id] || "";
                    const ready = m.home_team && m.away_team;
                    return (
                      <div key={m.id} className="border border-white/10 p-2">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">#{m.match_number} · {m.round}</div>
                        {!ready ? (
                          <div className="text-xs text-zinc-500">Välj vinnare i föregående kolumn först.</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-1">
                            {[m.home_team, m.away_team].map((team) => {
                              const isSelected = selected === team.id;
                              const isCorrectSelected = Boolean(
                                isSelected && m.is_finished && m.actual_winner_id && m.actual_winner_id === team.id
                              );
                              return (
                                <button
                                  key={team.id}
                                  disabled={locked}
                                  onClick={() => onPickWinner(stage, m.id, team.id)}
                                  className={`flex items-center gap-2 px-2 py-2 border text-left transition-all ${
                                    isCorrectSelected
                                      ? "border-[#FFCC00] bg-[#FFCC00]/20 text-[#FFCC00]"
                                      : isSelected
                                      ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white"
                                      : "border-white/10 text-zinc-300 hover:border-white/30"
                                  }`}
                                >
                                  <Flag code={team.country_code} size={18} />
                                  <span className="text-sm font-semibold truncate">{team.team_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {shouldShowBronze && (
            <div className="surface p-3 min-w-[260px] shrink-0">
              <div className="label-eyebrow mb-2">Bronsvinnare</div>
              <div className="space-y-1">
                {(tree.generated_matches?.third_place?.[0] ? [tree.generated_matches.third_place[0].home_team, tree.generated_matches.third_place[0].away_team].filter(Boolean) : []).map((team) => {
                  const selected = state.bronze_winner === team.id;
                  const actualWinner = tree.generated_matches?.third_place?.[0]?.actual_winner_id;
                  const isCorrect = selected && actualWinner && actualWinner === team.id;
                  return (
                    <button
                      key={team.id}
                      disabled={locked}
                      onClick={() => onPickBronze(team.id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 border text-left ${
                        isCorrect
                          ? "border-[#FFCC00] bg-[#FFCC00]/20 text-[#FFCC00]"
                          : selected
                          ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white"
                          : "border-white/10 text-zinc-300"
                      }`}
                    >
                      <Flag code={team.country_code} size={18} />
                      <span className="text-sm font-semibold truncate">{team.team_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shouldShowChampion && (
            <div className="surface p-3 min-w-[260px] shrink-0">
              <div className="label-eyebrow mb-2">Mästare</div>
              <div className="space-y-1">
                {(tree.generated_matches?.final?.[0] ? [tree.generated_matches.final[0].home_team, tree.generated_matches.final[0].away_team].filter(Boolean) : []).map((team) => {
                  const selected = state.champion === team.id;
                  const actualWinner = tree.generated_matches?.final?.[0]?.actual_winner_id;
                  const isCorrect = selected && actualWinner && actualWinner === team.id;
                  return (
                    <button
                      key={team.id}
                      disabled={locked}
                      onClick={() => onPickChampion(team.id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 border text-left ${
                        isCorrect
                          ? "border-[#FFCC00] bg-[#FFCC00]/20 text-[#FFCC00]"
                          : selected
                          ? "border-[#00F0FF] bg-[#00F0FF]/10 text-white"
                          : "border-white/10 text-zinc-300"
                      }`}
                    >
                      <Flag code={team.country_code} size={18} />
                      <span className="text-sm font-semibold truncate">{team.team_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function TournamentPrediction() {
  const [versions, setVersions] = useState([]);
  const [activeId, setActiveId] = useState("pre_tournament");
  const [groups, setGroups] = useState({});
  const [confirmedAdvancing, setConfirmedAdvancing] = useState([]);
  const [confirmedR16, setConfirmedR16] = useState([]);
  const [confirmedQf, setConfirmedQf] = useState([]);
  const [confirmedSf, setConfirmedSf] = useState([]);
  const [confirmedFinalists, setConfirmedFinalists] = useState([]);
  const [bronzeWinner, setBronzeWinner] = useState("");
  const [championWinner, setChampionWinner] = useState("");
  const [pred, setPred] = useState({ group_rankings: {}, advancing: [], r32: [], r16: [], qf: [], sf: [], third_place: [], finalists: [], champion: "" });
  const [koTree, setKoTree] = useState(null);
  const [koState, setKoState] = useState({ picks: { r32: {}, r16: {}, qf: {}, sf: {}, third_place: {}, final: {} }, champion: "", bronze_winner: "" });
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeErr, setTreeErr] = useState("");
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");

  const allTeams = useMemo(() => Object.values(groups).flat(), [groups]);
  const tmap = useMemo(() => {
    const m = {}; allTeams.forEach((t) => (m[t.id] = t)); return m;
  }, [allTeams]);
  const active = versions.find((v) => v.id === activeId);
  const countdownLabel = useCountdown(active?.locked ? null : active?.deadline, { closedLabel: "" });

  const loadAll = async () => {
    const { data } = await api.get("/strategy/versions");
    setVersions(data);
    const g = (await api.get("/teams/groups")).data;
    setGroups(g);
    const progress = (await api.get("/strategy/pre-tournament-progress")).data;
    setConfirmedAdvancing(progress?.confirmed_advancing || []);
    setConfirmedR16(progress?.confirmed_r16 || []);
    setConfirmedQf(progress?.confirmed_qf || []);
    setConfirmedSf(progress?.confirmed_sf || []);
    setConfirmedFinalists(progress?.confirmed_finalists || []);
    setBronzeWinner(progress?.bronze_winner || "");
    setChampionWinner(progress?.champion || "");
  };
  useEffect(() => { loadAll(); }, []);

  const loadKnockoutTree = async (versionId, payload = null) => {
    if (!versionId || versionId === "pre_tournament") return;
    setTreeLoading(true);
    setTreeErr("");
    try {
      const res = payload
        ? await api.post(`/strategy/version/${versionId}/tree/preview`, payload)
        : await api.get(`/strategy/version/${versionId}/tree`);
      const data = res.data;
      setKoTree(data);
      setKoState({
        picks: data.picks || { r32: {}, r16: {}, qf: {}, sf: {}, third_place: {}, final: {} },
        champion: data.champion || "",
        bronze_winner: data.bronze_winner || "",
      });
    } catch (e) {
      setTreeErr(formatError(e));
    } finally {
      setTreeLoading(false);
    }
  };

  // Load active version data when switching versions
  useEffect(() => {
    if (!activeId) return;
    setSaved(""); setErr("");
    if (activeId === "pre_tournament") {
      setKoTree(null);
      setTreeErr("");
    } else {
      loadKnockoutTree(activeId);
    }
    // Load my existing submission for this version
    const v = versions.find((x) => x.id === activeId);
    const mine = v?.my_submission;
    if (mine) {
      if (activeId === "pre_tournament") {
        setPred({
          group_rankings: mine.group_rankings || {},
          advancing: mine.advancing || [],
          r32: mine.r32 || [], r16: mine.r16 || [], qf: mine.qf || [],
          sf: mine.sf || [], third_place: mine.third_place || [], finalists: mine.finalists || [], champion: mine.champion || "",
        });
      } else {
        const picks = mine.picks || {};
        const isFlat = Object.values(picks).every((v) => typeof v === "string");
        setKoState({
          picks: isFlat ? { r32: picks, r16: {}, qf: {}, sf: {}, third_place: {}, final: {} } : picks,
          champion: mine.champion || "",
          bronze_winner: mine.bronze_winner || "",
        });
      }
    } else {
      setPred({ group_rankings: {}, advancing: [], r32: [], r16: [], qf: [], sf: [], third_place: [], finalists: [], champion: "" });
      setKoState({ picks: { r32: {}, r16: {}, qf: {}, sf: {}, third_place: {}, final: {} }, champion: "", bronze_winner: "" });
    }
  }, [activeId, versions]);

  const updateTreePreview = async (nextState) => {
    setKoState(nextState);
    await loadKnockoutTree(activeId, nextState);
  };

  const onPickWinner = async (stage, matchId, teamId) => {
    const next = {
      ...koState,
      picks: {
        ...koState.picks,
        [stage]: {
          ...(koState.picks?.[stage] || {}),
          [matchId]: teamId,
        },
      },
    };
    if (stage === "final") next.champion = teamId;
    if (stage === "third_place") next.bronze_winner = teamId;
    await updateTreePreview(next);
  };

  const onPickChampion = async (teamId) => {
    await updateTreePreview({ ...koState, champion: teamId });
  };

  const onPickBronze = async (teamId) => {
    await updateTreePreview({ ...koState, bronze_winner: teamId });
  };

  const submit = async () => {
    setErr(""); setSaved("");
    try {
      const body = activeId === "pre_tournament"
        ? { ...pred }
        : { picks: koState.picks, champion: koState.champion, bronze_winner: koState.bronze_winner };
      await api.post(`/strategy/version/${activeId}`, body);
      setSaved(`${active?.label} sparat`);
      await loadAll();
    } catch (e) { setErr(formatError(e)); }
  };

  const locked = active?.locked || false;
  const submittedBadge = active?.my_submitted;

  return (
    <div className="space-y-6">
      <div>
        <div className="label-eyebrow">Strategi · Turneringstips</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Turneringstips</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Sju omgångar — Första Tipset sätter hela bracket, sedan en omgång före varje slutspelsskede med endast vinnartips per match.
        </p>
      </div>

      {/* Version selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {versions.map((v) => (
          <button
            key={v.id}
            data-testid={`version-${v.id}`}
            onClick={() => setActiveId(v.id)}
            className={`p-3 border text-left transition-all ${
              activeId === v.id ? "border-[#00F0FF] bg-[#00F0FF]/10" : "border-white/10 hover:border-white/30"
            }`}
          >
            <div className="label-eyebrow" style={{ color: v.id === "pre_tournament" ? "#00F0FF" : v.locked ? "#A1A1AA" : "#39FF14" }}>{v.label}</div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {v.match_count} {v.id === "pre_tournament" ? "gruppmatcher" : "matcher"}
              {v.points_per_correct ? ` · ${v.points_per_correct} p/rätt` : ""}
            </div>
            <div className="text-[10px] uppercase tracking-widest mt-2">
              {v.locked ? <span className="text-zinc-500">Stängd</span> :
                v.my_submitted ? <span className="text-[#39FF14]">Sparad</span> :
                <span className="text-[#FFCC00]">Öppen</span>}
            </div>
          </button>
        ))}
      </div>


      {/* Active version banner - only show for knockout versions */}
      {active && activeId !== "pre_tournament" && (
        locked ? (
          <div className="surface p-3 text-xs text-zinc-400" data-testid={`${activeId}-closed-banner`}>
            <span className="font-bold uppercase tracking-widest">{active.label}:</span> Tippning stängd.
            {active.deadline && <span className="ml-2">Stängde {fmtSwedishCompact(active.deadline)} (Europe/Stockholm)</span>}
          </div>
        ) : active.deadline ? (
          <div className="surface p-3 text-xs text-[#FFCC00] border border-[#FFCC00]" data-testid={`${activeId}-open-banner`}>
            <span className="font-bold uppercase tracking-widest">{active.label} stänger:</span> {fmtSwedishCompact(active.deadline)} (Europe/Stockholm)
            {countdownLabel && <span className="ml-2 normal-case text-white"> · {countdownLabel}</span>}
          </div>
        ) : (
          <div className="surface p-3 text-xs text-zinc-500" data-testid={`${activeId}-no-deadline-banner`}>
            Deadline beräknas så snart slutspelsschemat är klart.
          </div>
        )
      )}

      <div className="surface p-3 text-xs text-zinc-400 flex items-center gap-2">
        <Lightning size={16} className="text-[#00F0FF]" weight="fill" />
        {activeId === "pre_tournament" ? (
          <>Första Tipset · Gruppvinnare +5 · Vidare +3 · Bracket-skeden 4–30 p</>
        ) : (
          <>{active?.label} · {Object.entries(active?.points_by_stage || {}).map(([k, v]) => `${k}: ${v}p`).join(" · ")}</>
        )}
      </div>

      {/* Editor */}
      {activeId === "pre_tournament" ? (
        <PreTournamentEditor
          groups={groups}
          allTeams={allTeams}
          tmap={tmap}
          pred={pred}
          setPred={setPred}
          locked={locked}
          confirmedAdvancing={confirmedAdvancing}
          confirmedR16={confirmedR16}
          confirmedQf={confirmedQf}
          confirmedSf={confirmedSf}
          confirmedFinalists={confirmedFinalists}
          bronzeWinner={bronzeWinner}
          championWinner={championWinner}
        />
      ) : (
        <FullKnockoutTreeEditor
          tree={koTree}
          state={koState}
          onPickWinner={onPickWinner}
          onPickChampion={onPickChampion}
          onPickBronze={onPickBronze}
          locked={locked}
          loading={treeLoading}
          err={treeErr}
        />
      )}

      {err && <div className="text-[#FF3B30] text-sm">{err}</div>}
      {saved && <div className="text-[#39FF14] text-sm" data-testid="save-feedback">{saved}</div>}

      <div className="sticky bottom-20 z-20">
        <button
          data-testid="submit-tournament-prediction"
          onClick={submit}
          disabled={locked}
          className="w-full bg-[#00F0FF] text-black font-bold uppercase tracking-widest py-4 hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <Star size={20} weight="fill" />
            {locked ? `${active?.label} är låst` : `Spara ${active?.label || ""}`}
          </span>
        </button>
      </div>
    </div>
  );
}
