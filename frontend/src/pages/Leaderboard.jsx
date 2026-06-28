import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Crown, Medal } from "@phosphor-icons/react";

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState("total");

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/leaderboard");
      setRows(data);
    })();
  }, []);

  const sorted = [...rows].sort((a, b) => {
    if (tab === "accuracy") {
      const totalA = a.accuracy_percentage || 0;
      const totalB = b.accuracy_percentage || 0;
      if (totalB !== totalA) return totalB - totalA;

      const stratA = a.strategy_correct_count || 0;
      const stratB = b.strategy_correct_count || 0;
      if (stratB !== stratA) return stratB - stratA;

      const matchA = a.match_accuracy_points || 0;
      const matchB = b.match_accuracy_points || 0;
      if (matchB !== matchA) return matchB - matchA;

      const predictedA = a.predicted_finished_matches || 0;
      const predictedB = b.predicted_finished_matches || 0;
      if (predictedB !== predictedA) return predictedB - predictedA;

      return (a.name || "").localeCompare((b.name || ""), "sv");
    }
    if (tab === "live") return b.live_points - a.live_points;
    if (tab === "strategy") return b.strategy_points - a.strategy_points;
    return b.total_points - a.total_points;
  });

  const ranked = (() => {
    let currentRank = 1;
    let previousValue = null;
    return sorted.map((row, index) => {
      const value = tab === "live" ? row.live_points : tab === "strategy" ? row.strategy_points : row.total_points;
      const accuracyValue = row.accuracy_percentage || 0;
      const valueForRank = tab === "accuracy" ? accuracyValue : value;
      if (index > 0 && valueForRank !== previousValue) {
        currentRank += 1;
      }
      previousValue = valueForRank;
      return { ...row, display_rank: currentRank };
    });
  })();

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden surface p-6">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1665413811870-5b29a250f64a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxjaGVlcmluZyUyMGZhbnMlMjBzdGFkaXVtfGVufDB8fHx8MTc4MTAwOTE3M3ww&ixlib=rb-4.1.0&q=85)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
        <div className="relative">
          <div className="label-eyebrow">Familjens ställning</div>
          <h1 className="font-display font-black text-4xl tracking-tighter">
            Topplista.
          </h1>
          <p className="text-zinc-300 text-sm mt-2 max-w-md">
            Total = Live + Strategi. Live växer match för match; Strategi är dina
            turneringstips.
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "total", label: "Totalpoäng" },
          { id: "live", label: "Livepoäng" },
          { id: "strategy", label: "Strategipoäng" },
          { id: "accuracy", label: "Träffsäkerhet" },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 text-xs uppercase tracking-widest font-bold border transition-all ${
              tab === t.id
                ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="surface overflow-hidden">
        {tab === "accuracy" ? (
          <>
            <div className="grid grid-cols-[34px_minmax(0,1fr)_56px_56px_56px] sm:grid-cols-[44px_minmax(0,1fr)_90px_90px_90px] gap-1 sm:gap-2 px-3 py-2 label-eyebrow border-b border-white/10 text-[10px] sm:text-xs">
              <div>#</div>
              <div>Spelare</div>
              <div className="text-right">Match %</div>
              <div className="text-right">Strategi %</div>
              <div className="text-right">Total %</div>
            </div>

            {ranked.map((r) => {
              const matchPoints = r.match_accuracy_points || 0;
              const matchMax = r.match_accuracy_max || 0;
              const stratCorrect = r.strategy_correct_count || 0;
              const stratPossible = r.strategy_possible_count || 0;
              const totalCorrect = matchPoints + stratCorrect;
              const totalPossible = matchMax + stratPossible;
              const matchPct = (r.match_accuracy_max || 0) > 0
                ? ((r.match_accuracy_points || 0) / r.match_accuracy_max) * 100
                : 0;
              const stratPct = (r.strategy_possible_count || 0) > 0
                ? ((r.strategy_correct_count || 0) / r.strategy_possible_count) * 100
                : 0;
              const totalPct = r.accuracy_percentage || 0;
              return (
                <div
                  key={r.user_id}
                  data-testid={`board-row-${r.user_id}`}
                  className={`grid grid-cols-[34px_minmax(0,1fr)_56px_56px_56px] sm:grid-cols-[44px_minmax(0,1fr)_90px_90px_90px] gap-1 sm:gap-2 px-3 py-3 border-b border-white/5 text-sm items-center ${
                    r.user_id === user?.id ? "bg-[#00F0FF]/5" : ""
                  }`}
                >
                  <div className="font-display font-black min-w-0">
                    <span className="sm:hidden">{r.display_rank}</span>
                    <span className="hidden sm:inline">
                      {r.display_rank === 1 ? (
                        <Crown size={18} weight="fill" className="text-[#FFCC00]" />
                      ) : r.display_rank === 2 ? (
                        <Medal size={18} weight="fill" className="text-zinc-300" />
                      ) : r.display_rank === 3 ? (
                        <Medal size={18} weight="fill" className="text-orange-400" />
                      ) : (
                        r.display_rank
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 truncate">
                    <div className="font-semibold truncate">{r.name}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest truncate">{r.role}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono tabular-nums">{matchPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums">{matchPoints}/{matchMax}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums">{stratPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums">{stratCorrect}/{stratPossible}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums font-bold text-[#39FF14]">{totalPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums">{totalCorrect}/{totalPossible}</div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div className="grid grid-cols-[34px_minmax(0,1fr)_40px_48px_40px] sm:grid-cols-[44px_minmax(0,1fr)_70px_90px_70px] gap-1 sm:gap-2 px-3 py-2 label-eyebrow border-b border-white/10 text-[10px] sm:text-xs">
          <div>#</div>
          <div>Spelare</div>
          <div className="text-right">
            <span className="sm:hidden">L</span>
            <span className="hidden sm:inline">Live</span>
          </div>
          <div className="text-right">
            <span className="sm:hidden">STR</span>
            <span className="hidden sm:inline">Strategi</span>
          </div>
          <div className="text-right">
            <span className="sm:hidden">TOT</span>
            <span className="hidden sm:inline">Totalt</span>
          </div>
        </div>

        {ranked.map((r, idx) => (
          <div
            key={r.user_id}
            data-testid={`board-row-${r.user_id}`}
            className={`grid grid-cols-[34px_minmax(0,1fr)_40px_48px_40px] sm:grid-cols-[44px_minmax(0,1fr)_70px_90px_70px] gap-1 sm:gap-2 px-3 py-3 border-b border-white/5 text-sm items-center ${
              r.user_id === user?.id ? "bg-[#00F0FF]/5" : ""
            }`}
          >
            <div className="font-display font-black min-w-0">
              <span className="sm:hidden">{r.display_rank}</span>

              <span className="hidden sm:inline">
                {r.display_rank === 1 ? (
                  <Crown size={18} weight="fill" className="text-[#FFCC00]" />
                ) : r.display_rank === 2 ? (
                  <Medal size={18} weight="fill" className="text-zinc-300" />
                ) : r.display_rank === 3 ? (
                  <Medal size={18} weight="fill" className="text-orange-400" />
                ) : (
                  r.display_rank
                )}
              </span>
            </div>

            <div className="min-w-0 truncate">
              <div className="font-semibold truncate">{r.name}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest truncate">
                {r.role}
              </div>
            </div>

            <div className="text-right font-mono tabular-nums">
              {r.live_points}
            </div>

            <div className="text-right font-mono tabular-nums">
              {r.strategy_points}
            </div>

            <div className="text-right font-mono tabular-nums font-bold text-[#39FF14]">
              {r.total_points}
            </div>
          </div>
        ))}
          </>
        )}

        {sorted.length === 0 && (
          <div className="p-6 text-center text-zinc-500 text-sm">
            Inga spelare ännu.
          </div>
        )}
      </div>
    </div>
  );
}