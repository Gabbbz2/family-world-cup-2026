import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Crown, Medal, Trophy } from "@phosphor-icons/react";

export default function HallOfFame() {
  const [rows, setRows] = useState([]);
  useEffect(() => { (async () => setRows((await api.get("/hall-of-fame")).data))(); }, []);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden surface p-6">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#FFCC00]/10 blur-3xl" />
        <div className="label-eyebrow">Familjens historia</div>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tighter">Hall of Fame.</h1>
        <p className="text-zinc-400 mt-2 text-sm">Tidigare mästare och pallplatser från familjens VM-tipsspel.</p>
      </div>

      {rows.length === 0 ? (
        <div className="surface p-10 text-center">
          <Trophy size={48} weight="fill" className="mx-auto text-zinc-700 mb-3" />
          <div className="font-display font-black text-xl mb-1">Ingen historia ännu</div>
          <div className="text-zinc-500 text-sm">När VM 2026 är slut hamnar de tre bästa här.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.year} className="surface p-4" data-testid={`hof-${r.year}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-black text-3xl tracking-tighter text-[#FFCC00]">{r.year}</div>
                <div className="label-eyebrow text-zinc-500">VM-tipsspel</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border border-[#FFCC00] p-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <Crown size={20} weight="fill" className="text-[#FFCC00]" />
                    <span className="label-eyebrow text-[#FFCC00]">Vinnare</span>
                  </div>
                  <div className="font-display font-bold text-lg">{r.winner_name}</div>
                  <div className="font-mono text-[#39FF14] text-sm">{r.winner_points} p</div>
                </div>
                <div className="border border-zinc-400 p-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <Medal size={20} weight="fill" className="text-zinc-300" />
                    <span className="label-eyebrow text-zinc-300">2:a plats</span>
                  </div>
                  <div className="font-display font-bold text-lg">{r.second_name}</div>
                  <div className="font-mono text-zinc-400 text-sm">{r.second_points} p</div>
                </div>
                <div className="border border-orange-400 p-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <Medal size={20} weight="fill" className="text-orange-400" />
                    <span className="label-eyebrow text-orange-400">3:e plats</span>
                  </div>
                  <div className="font-display font-bold text-lg">{r.third_name}</div>
                  <div className="font-mono text-zinc-400 text-sm">{r.third_points} p</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
