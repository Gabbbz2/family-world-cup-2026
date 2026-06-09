import React, { useEffect, useMemo, useState } from "react";
import { api, formatError } from "../lib/api";
import { FlagTeam, Flag } from "../components/FlagTeam";
import {
  UserPlus, Trash, ShieldCheck, ShieldChevron, ArrowsClockwise,
  UploadSimple, Warning, CheckCircle, ClipboardText, CalendarBlank, Prohibit, Recycle,
  Pause, Play, MagnifyingGlass, CaretLeft, CaretRight, Star,
} from "@phosphor-icons/react";
import {
  fmtSwedishShort, fmtSwedishCompact,
  utcIsoToSwedishLocalInput, swedishLocalInputToUtcIso,
} from "../lib/dates";

function Section({ title, children, action }) {
  return (
    <section className="surface p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-display font-bold text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const TABS = [
  { id: "results", label: "Resultat" },
  { id: "teams", label: "Lag / DQ" },
  { id: "import", label: "Importera" },
  { id: "deadlines", label: "Deadlines" },
  { id: "users", label: "Användare" },
  { id: "invites", label: "Inbjudningar" },
  { id: "scoring", label: "Poäng" },
  { id: "halloffame", label: "Hall of Fame" },
  { id: "audit", label: "Aktivitetslogg" },
];

// ---------- Results ----------
function ResultsTab() {
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState("all");
  const [stage, setStage] = useState("all");
  const [group, setGroup] = useState("all");
  const [tv, setTv] = useState("all");
  const [search, setSearch] = useState("");
  const [swedenOnly, setSwedenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState("");
  const PAGE_SIZE = 20;

  const load = async () => {
    const { data } = await api.get("/matches");
    setMatches(data);
  };
  useEffect(() => { load(); }, []);

  const setResult = async (m, h, a) => {
    await api.put(`/matches/${m.id}/result`, { home_score: parseInt(h), away_score: parseInt(a) });
    setMsg(`Sparat · #${m.match_number || ""}. Ställning + slutspel + poäng räknade om.`);
    load();
  };
  const clearResult = async (m) => {
    if (!window.confirm("Rensa resultatet och räkna om?")) return;
    await api.delete(`/matches/${m.id}/result`);
    setMsg(`Rensade #${m.match_number}`); load();
  };
  const progress = async () => {
    await api.post("/admin/progress");
    setMsg("Slutspelsschema uppdaterat."); load();
  };
  const recompute = async () => {
    await api.post("/admin/recompute");
    setMsg("Alla poäng räknade om."); load();
  };

  const groupOptions = useMemo(() => {
    const s = new Set(matches.map((m) => m.group).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [matches]);
  const tvOptions = useMemo(() => {
    const s = new Set(matches.map((m) => m.tv_channel).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [matches]);

  const filtered = useMemo(() => matches.filter((m) => {
    if (filter === "with-result" && m.status !== "finished") return false;
    if (filter === "no-result" && m.status === "finished") return false;
    if (stage === "group" && m.stage !== "Group Stage") return false;
    if (stage === "knockout" && m.stage !== "Knockout") return false;
    if (group !== "all" && m.group !== group) return false;
    if (tv !== "all" && m.tv_channel !== tv) return false;
    if (swedenOnly) {
      const hn = m.home_team?.team_name?.toLowerCase() || "";
      const an = m.away_team?.team_name?.toLowerCase() || "";
      if (!hn.includes("sverige") && !an.includes("sverige")) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const all = [
        m.home_team?.team_name, m.away_team?.team_name,
        m.home_placeholder, m.away_placeholder, String(m.match_number || ""),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!all.includes(q)) return false;
    }
    return true;
  }), [matches, filter, stage, group, tv, swedenOnly, search]);

  useEffect(() => { setPage(1); }, [filter, stage, group, tv, swedenOnly, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}

      {/* Filters */}
      <div className="surface p-3 space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              data-testid="res-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök lag eller matchnummer…"
              className="w-full bg-[#0A0A0A] border border-white/10 pl-7 pr-3 py-2 text-sm"
            />
          </div>
          <button data-testid="res-sweden-only" onClick={() => setSwedenOnly((v) => !v)}
            className={`px-3 py-2 text-xs uppercase tracking-widest font-bold border inline-flex items-center gap-1 ${
              swedenOnly ? "bg-[#FFCC00] text-black border-[#FFCC00]" : "border-white/10 text-zinc-400"
            }`}>
            <Star size={12} weight="fill" /> Endast Sverige
          </button>
          <button data-testid="progress-btn" onClick={progress}
            className="text-xs uppercase tracking-widest border border-white/10 text-[#FFCC00] px-3 py-2 inline-flex items-center gap-1">
            <Recycle size={14} /> Uppdatera bracket
          </button>
          <button data-testid="recompute-btn" onClick={recompute}
            className="text-xs uppercase tracking-widest border border-white/10 text-[#00F0FF] px-3 py-2 inline-flex items-center gap-1">
            <ArrowsClockwise size={14} /> Räkna om poäng
          </button>
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          {[
            { k: "all", l: "Alla" }, { k: "no-result", l: "Utan resultat" }, { k: "with-result", l: "Med resultat" },
          ].map((f) => (
            <button key={f.k} data-testid={`res-filter-${f.k}`} onClick={() => setFilter(f.k)}
              className={`px-2 py-1 uppercase tracking-widest font-bold border ${
                filter === f.k ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 text-zinc-400"
              }`}>{f.l}</button>
          ))}
          <span className="text-zinc-700 mx-1">|</span>
          {[
            { k: "all", l: "Alla skeden" }, { k: "group", l: "Gruppspel" }, { k: "knockout", l: "Slutspel" },
          ].map((s) => (
            <button key={s.k} data-testid={`res-stage-${s.k}`} onClick={() => setStage(s.k)}
              className={`px-2 py-1 uppercase tracking-widest font-bold border ${
                stage === s.k ? "bg-[#39FF14] text-black border-[#39FF14]" : "border-white/10 text-zinc-400"
              }`}>{s.l}</button>
          ))}
          <span className="text-zinc-700 mx-1">|</span>
          <select data-testid="res-group" value={group} onChange={(e) => setGroup(e.target.value)}
            className="bg-[#0A0A0A] border border-white/10 px-2 py-1 uppercase tracking-widest">
            {groupOptions.map((g) => <option key={g} value={g}>{g === "all" ? "Alla grupper" : `Grupp ${g}`}</option>)}
          </select>
          <select data-testid="res-tv" value={tv} onChange={(e) => setTv(e.target.value)}
            className="bg-[#0A0A0A] border border-white/10 px-2 py-1 uppercase tracking-widest">
            {tvOptions.map((t) => <option key={t} value={t}>{t === "all" ? "Alla kanaler" : t}</option>)}
          </select>
        </div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{filtered.length} av {matches.length} matcher</div>
      </div>

      <div className="space-y-2">
        {pageRows.map((m) => (
          <div key={m.id} className="surface p-3 text-sm" data-testid={`res-row-${m.id}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="bg-[#1C1C1C] border border-white/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">#{m.match_number}</span>
                <span className="label-eyebrow">{m.round || m.stage}</span>
                {m.group && <span className="label-eyebrow text-[#00F0FF]">G {m.group}</span>}
                {m.tv_channel && <span className="text-[10px] uppercase tracking-widest text-[#FFCC00]">{m.tv_channel}</span>}
              </div>
              <span className="text-[10px] text-zinc-500">{fmtSwedishShort(m.kickoff)}</span>
            </div>
            <div className="mt-2 grid grid-cols-7 items-center gap-2">
              <div className="col-span-3"><FlagTeam team={m.home_team} placeholder={m.home_placeholder} size={18} /></div>
              <div className="col-span-1 text-center text-zinc-500">vs</div>
              <div className="col-span-3 flex justify-end"><FlagTeam team={m.away_team} placeholder={m.away_placeholder} size={18} reverse /></div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <input id={`hres-${m.id}`} data-testid={`res-h-${m.id}`} type="number" min={0} defaultValue={m.home_score ?? ""}
                className="w-14 bg-[#0A0A0A] border border-white/10 text-center py-1" placeholder="—" />
              <span>:</span>
              <input id={`ares-${m.id}`} data-testid={`res-a-${m.id}`} type="number" min={0} defaultValue={m.away_score ?? ""}
                className="w-14 bg-[#0A0A0A] border border-white/10 text-center py-1" placeholder="—" />
              <button data-testid={`res-save-${m.id}`}
                onClick={() => {
                  const h = document.getElementById(`hres-${m.id}`).value;
                  const a = document.getElementById(`ares-${m.id}`).value;
                  if (h === "" || a === "") return alert("Ange båda målen");
                  setResult(m, h, a);
                }}
                className="bg-[#39FF14] text-black font-bold px-3 py-1 text-xs uppercase tracking-widest">Spara</button>
              {m.status === "finished" && (
                <button data-testid={`res-clear-${m.id}`} onClick={() => clearResult(m)}
                  className="text-[#FF3B30] text-xs uppercase tracking-widest border border-white/10 px-2 py-1 inline-flex items-center gap-1">
                  <Trash size={12} /> Rensa
                </button>
              )}
              {m.status === "finished" && (
                <span className="ml-auto text-[#39FF14] inline-flex items-center gap-1 text-xs">
                  <CheckCircle size={14} weight="fill" /> Klar
                </span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="surface p-6 text-zinc-500 text-sm text-center">Inga matcher matchar filter.</div>}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 text-xs">
        <button data-testid="page-prev" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
          className="border border-white/10 px-2 py-1 disabled:opacity-30 inline-flex items-center gap-1">
          <CaretLeft size={12} /> Föregående
        </button>
        <span className="uppercase tracking-widest text-zinc-400">Sida {page} / {totalPages}</span>
        <button data-testid="page-next" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
          className="border border-white/10 px-2 py-1 disabled:opacity-30 inline-flex items-center gap-1">
          Nästa <CaretRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ---------- Teams (DQ) ----------
function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [reason, setReason] = useState({});
  const [msg, setMsg] = useState("");
  const load = async () => setTeams((await api.get("/teams")).data);
  useEffect(() => { load(); }, []);
  const dq = async (t) => {
    const r = reason[t.id];
    if (!r || !r.trim()) return alert("Anledning krävs");
    if (!window.confirm(`Diskvalificera ${t.team_name}? Anledning: ${r}`)) return;
    try {
      await api.post("/admin/teams/disqualify", { team_id: t.id, reason: r });
      setMsg(`${t.team_name} är diskvalificerat`); load();
    } catch (e) { setMsg(formatError(e)); }
  };
  const reinstate = async (t) => {
    if (!window.confirm(`Återinför ${t.team_name}?`)) return;
    await api.post(`/admin/teams/${t.id}/reinstate`);
    setMsg(`${t.team_name} är återinfört`); load();
  };
  const groups = {};
  teams.forEach((t) => { groups[t.group] = groups[t.group] || []; groups[t.group].push(t); });
  return (
    <div className="space-y-3">
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}
      <p className="text-zinc-500 text-xs">Diskvalificering uppdaterar automatiskt ställning, slutspel, prognoser och strategipoäng. En händelse skrivs i aktivitetsloggen.</p>
      {Object.keys(groups).sort().map((g) => (
        <div key={g} className="surface p-3">
          <div className="label-eyebrow mb-2">Grupp {g}</div>
          <div className="space-y-2">
            {groups[g].map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm" data-testid={`team-row-${t.id}`}>
                <Flag code={t.country_code} size={20} />
                <span className={`font-semibold ${t.disqualified ? "line-through text-zinc-500" : ""}`}>{t.team_name}</span>
                {t.disqualified ? (
                  <>
                    <span className="text-[10px] uppercase tracking-widest bg-[#FF3B30] text-white px-1 py-0.5">DQ</span>
                    <span className="text-zinc-500 text-xs truncate">{t.disqualified_reason}</span>
                    <button data-testid={`reinstate-${t.id}`} onClick={() => reinstate(t)} className="ml-auto text-xs text-[#39FF14] border border-white/10 px-2 py-1 uppercase tracking-widest inline-flex items-center gap-1">
                      <CheckCircle size={12} /> Återinför
                    </button>
                  </>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <input data-testid={`dq-reason-${t.id}`} value={reason[t.id] || ""} onChange={(e) => setReason((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Anledning…" className="bg-[#0A0A0A] border border-white/10 px-2 py-1 text-xs w-40" />
                    <button data-testid={`dq-${t.id}`} onClick={() => dq(t)} className="text-xs text-[#FF3B30] border border-[#FF3B30] px-2 py-1 uppercase tracking-widest inline-flex items-center gap-1">
                      <Prohibit size={12} /> Diskvalificera
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Import ----------
function ImportTab() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const doPreview = async () => {
    if (!file) return;
    setErr(""); setPreview(null); setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/admin/import-preview", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(data);
    } catch (e) { setErr(formatError(e)); }
    finally { setBusy(false); }
  };
  const doCommit = async () => {
    if (!file) return;
    if (!window.confirm("Detta ERSÄTTER alla lag och matcher med filens innehåll. Fortsätt?")) return;
    setErr(""); setResult(null); setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("replace", "true");
      const { data } = await api.post("/admin/import-commit", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
    } catch (e) { setErr(formatError(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <Section title="Excel-import">
        <p className="text-zinc-500 text-xs mb-3">Ladda upp VM2026-filen (.xlsx). Förhandsgranska först, sedan bekräfta. Befintliga matcher ersätts.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".xlsx,.xls" data-testid="import-file" onChange={(e) => setFile(e.target.files[0])} className="text-sm" />
          <button data-testid="import-preview-btn" disabled={!file || busy} onClick={doPreview}
            className="bg-[#00F0FF] text-black font-bold px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1">
            <ClipboardText size={14} /> Förhandsgranska
          </button>
          <button data-testid="import-commit-btn" disabled={!preview || busy} onClick={doCommit}
            className="bg-[#39FF14] text-black font-bold px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1">
            <UploadSimple size={14} weight="bold" /> Ersätt och importera
          </button>
        </div>
        {err && <div className="text-[#FF3B30] text-sm mt-3 inline-flex items-center gap-1"><Warning size={14} /> {err}</div>}
      </Section>
      {preview && (
        <Section title="Förhandsgranskning">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Lag</div><div className="font-display font-black text-2xl">{preview.summary.teams_count}</div></div>
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Matcher</div><div className="font-display font-black text-2xl">{preview.summary.matches_count}</div></div>
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Grupp</div><div className="font-display font-black text-2xl text-[#00F0FF]">{preview.summary.group_matches}</div></div>
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Slutspel</div><div className="font-display font-black text-2xl text-[#39FF14]">{preview.summary.knockout_matches}</div></div>
          </div>
          <div className="mt-3 text-xs text-zinc-400">Grupper: {preview.summary.groups_detected.join(", ")}</div>
          {preview.summary.duplicates.length > 0 && <div className="text-[#FFCC00] text-xs mt-2">Dubbletter: {preview.summary.duplicates.join(", ")}</div>}
          {preview.summary.errors.length > 0 && <div className="text-[#FF3B30] text-xs mt-2">Fel: {preview.summary.errors.join("; ")}</div>}
        </Section>
      )}
      {result && (
        <Section title="Importresultat">
          <div className="text-[#39FF14] text-sm inline-flex items-center gap-1"><CheckCircle size={14} weight="fill" /> Importerat {result.teams_inserted} lag, {result.matches_inserted} matcher.</div>
        </Section>
      )}
    </div>
  );
}

// ---------- Deadlines (V1-V4) ----------
function DeadlinesTab() {
  const [deadlines, setDeadlines] = useState({});
  const [inputs, setInputs] = useState({});
  const [msg, setMsg] = useState("");
  const load = async () => {
    const { data } = await api.get("/config/deadlines");
    setDeadlines(data);
    const next = {};
    for (const v of [1, 2, 3, 4]) {
      next[v] = data[String(v)] ? utcIsoToSwedishLocalInput(data[String(v)]) : "";
    }
    setInputs(next);
  };
  useEffect(() => { load(); }, []);
  const save = async (v) => {
    if (!inputs[v]) return;
    const iso = swedishLocalInputToUtcIso(inputs[v]);
    await api.post(`/config/v${v}-deadline`, { deadline: iso });
    setMsg(`Version ${v} deadline uppdaterad`); load();
  };
  return (
    <Section title="Deadlines Version 1–4">
      <p className="text-zinc-500 text-xs mb-3">Anges i svensk lokaltid (Europe/Stockholm). När deadline passerats kan tipset för den versionen inte längre redigeras.</p>
      {msg && <div className="text-[#39FF14] text-sm mb-2">{msg}</div>}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((v) => (
          <div key={v} className="border border-white/10 p-3" data-testid={`dl-row-${v}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="label-eyebrow w-20">Version {v}</div>
              <input type="datetime-local" data-testid={`dl-input-${v}`}
                value={inputs[v] || ""} onChange={(e) => setInputs((p) => ({ ...p, [v]: e.target.value }))}
                className="bg-[#0A0A0A] border border-white/10 px-3 py-2 text-sm" />
              <button data-testid={`dl-save-${v}`} onClick={() => save(v)} disabled={!inputs[v]}
                className="bg-[#00F0FF] text-black font-bold px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1">
                <CalendarBlank size={14} /> Spara V{v}
              </button>
              {deadlines[String(v)] && (
                <span className="text-xs text-zinc-400">Aktuell: {fmtSwedishCompact(deadlines[String(v)])}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------- Users with status ----------
const STATUS_BADGES = {
  active: { label: "Aktiv", color: "bg-[#39FF14] text-black" },
  deactivated: { label: "Avaktiverad", color: "bg-zinc-600 text-white" },
  banned: { label: "Blockerad", color: "bg-[#FF3B30] text-white" },
  deleted: { label: "Raderad", color: "bg-zinc-900 text-zinc-500" },
};

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("active");
  const load = async () => setUsers((await api.get("/admin/users")).data);
  useEffect(() => { load(); }, []);

  const setStatus = async (u, status, needReason = false) => {
    let reason = null;
    if (needReason) {
      reason = window.prompt(`Ange anledning till blockering av ${u.name}:`);
      if (!reason) return;
    } else {
      if (!window.confirm(`${status === "deactivated" ? "Avaktivera" : "Aktivera"} ${u.name}?`)) return;
    }
    try {
      await api.put(`/admin/users/${u.id}/status`, { status, reason });
      setMsg(`${u.name} → ${STATUS_BADGES[status].label}`); load();
    } catch (e) { setMsg(formatError(e)); }
  };
  const unban = async (u) => {
    if (!window.confirm(`Häv blockering av ${u.name}?`)) return;
    await api.post(`/admin/users/${u.id}/unban`);
    setMsg(`${u.name} avblockerad`); load();
  };
  const toggleRole = async (u) => {
    const next = u.role === "admin" ? "user" : "admin";
    if (!window.confirm(`${next === "admin" ? "Gör admin" : "Ta bort admin"} för ${u.name}?`)) return;
    await api.put(`/admin/users/${u.id}/role`, { role: next });
    setMsg(`${u.name} → ${next}`); load();
  };
  const permaDelete = async (u) => {
    const ok = window.prompt(`Radera ${u.name} permanent? Skriv DELETE för att bekräfta.`);
    if (ok !== "DELETE") return;
    const reason = window.prompt("Anledning (valfritt):") || "";
    try {
      await api.delete(`/admin/users/${u.id}`, { data: { confirmation: "DELETE", reason } });
      setMsg(`${u.name} raderad`); load();
    } catch (e) { setMsg(formatError(e)); }
  };

  const filtered = users.filter((u) => {
    const s = u.status || "active";
    if (filter === "all") return true;
    return s === filter;
  });

  return (
    <Section title={`Användare (${filtered.length}/${users.length})`}>
      {msg && <div className="text-[#39FF14] text-sm mb-2" data-testid="user-msg">{msg}</div>}
      <div className="flex gap-2 mb-3 flex-wrap">
        {["active", "deactivated", "banned", "all"].map((f) => (
          <button key={f} data-testid={`user-filter-${f}`} onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs uppercase tracking-widest font-bold border ${
              filter === f ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 text-zinc-400"
            }`}>
            {f === "all" ? "Alla" : STATUS_BADGES[f]?.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((u) => {
          const status = u.status || "active";
          const badge = STATUS_BADGES[status];
          return (
            <div key={u.id} className="border border-white/10 p-3 text-sm" data-testid={`admin-user-${u.id}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold inline-flex items-center gap-2">
                    {u.name}
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 ${badge.color}`}>{badge.label}</span>
                    {u.role === "admin" && <span className="text-[10px] uppercase tracking-widest font-bold bg-[#FFCC00] text-black px-1.5 py-0.5">Admin</span>}
                  </div>
                  <div className="text-zinc-500 text-xs">
                    {u.email} · Med sedan {u.created_at ? fmtSwedishCompact(u.created_at) : "—"} · Senast inloggad {u.last_login ? fmtSwedishCompact(u.last_login) : "aldrig"}
                  </div>
                  {u.ban_reason && <div className="text-[#FF3B30] text-xs mt-1">Anledning: {u.ban_reason}</div>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {status === "active" && (
                    <button data-testid={`u-deactivate-${u.id}`} onClick={() => setStatus(u, "deactivated")}
                      className="text-xs uppercase tracking-widest border border-white/10 px-2 py-1 hover:border-zinc-400 hover:text-zinc-300 inline-flex items-center gap-1">
                      <Pause size={12} /> Avaktivera
                    </button>
                  )}
                  {status === "deactivated" && (
                    <button data-testid={`u-activate-${u.id}`} onClick={() => setStatus(u, "active")}
                      className="text-xs uppercase tracking-widest border border-[#39FF14] text-[#39FF14] px-2 py-1 inline-flex items-center gap-1">
                      <Play size={12} /> Aktivera
                    </button>
                  )}
                  {status !== "banned" && (
                    <button data-testid={`u-ban-${u.id}`} onClick={() => setStatus(u, "banned", true)}
                      className="text-xs uppercase tracking-widest border border-[#FF3B30] text-[#FF3B30] px-2 py-1 inline-flex items-center gap-1">
                      <Prohibit size={12} /> Blockera
                    </button>
                  )}
                  {status === "banned" && (
                    <button data-testid={`u-unban-${u.id}`} onClick={() => unban(u)}
                      className="text-xs uppercase tracking-widest border border-[#39FF14] text-[#39FF14] px-2 py-1 inline-flex items-center gap-1">
                      <CheckCircle size={12} /> Häv blockering
                    </button>
                  )}
                  <button data-testid={`role-toggle-${u.id}`} onClick={() => toggleRole(u)}
                    className="text-xs uppercase tracking-widest border border-white/10 px-2 py-1 hover:border-[#00F0FF] hover:text-[#00F0FF] inline-flex items-center gap-1">
                    {u.role === "admin" ? <><ShieldChevron size={12} /> Ta bort admin</> : <><ShieldCheck size={12} /> Gör admin</>}
                  </button>
                  <button data-testid={`u-delete-${u.id}`} onClick={() => permaDelete(u)}
                    className="text-xs uppercase tracking-widest border border-white/10 text-zinc-500 hover:text-[#FF3B30] hover:border-[#FF3B30] px-2 py-1 inline-flex items-center gap-1">
                    <Trash size={12} /> Radera
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ---------- Invites ----------
function InvitesTab() {
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const load = async () => setInvites((await api.get("/admin/invites")).data);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!email) return;
    try { await api.post("/admin/invite", { email }); setEmail(""); setMsg("Inbjudan tillagd"); load(); }
    catch (e) { setMsg(formatError(e)); }
  };
  const remove = async (e) => { await api.delete(`/admin/invites/${encodeURIComponent(e)}`); load(); };
  return (
    <Section title={`Inbjudningar (${invites.length})`}>
      <div className="flex gap-2 mb-3">
        <input data-testid="invite-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adress@familj.se"
          className="flex-1 bg-[#0A0A0A] border border-white/10 px-3 py-2 text-sm" />
        <button data-testid="invite-add" onClick={add} className="bg-[#00F0FF] text-black font-bold px-3 py-2 inline-flex items-center gap-1">
          <UserPlus size={16} /> Bjud in
        </button>
      </div>
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}
      <div className="divide-y divide-white/10">
        {invites.length === 0 && <div className="text-zinc-500 text-sm py-3">Inga väntande inbjudningar.</div>}
        {invites.map((i) => (
          <div key={i.email} className="flex items-center justify-between py-2 text-sm" data-testid={`invite-${i.email}`}>
            <span>{i.email}</span>
            <button onClick={() => remove(i.email)} className="text-zinc-500 hover:text-[#FF3B30]"><Trash size={14} /></button>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------- Scoring ----------
function ScoringTab() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");
  const load = async () => setUsers((await api.get("/admin/users")).data);
  useEffect(() => { load(); }, []);
  const save = async (u) => {
    const val = document.getElementById(`strat-${u.id}`).value;
    await api.post("/admin/strategy-points", { user_id: u.id, points: parseInt(val || 0) });
    setMsg("Sparat"); load();
  };
  return (
    <Section title="Strategipoäng (manuell justering)">
      <p className="text-zinc-500 text-xs mb-3">Beräknas automatiskt från turneringstipsen, men kan justeras manuellt här.</p>
      {msg && <div className="text-[#39FF14] text-sm mb-2">{msg}</div>}
      <div className="space-y-2">
        {users.filter((u) => (u.status || "active") !== "deleted").map((u) => (
          <div key={u.id} className="border border-white/10 p-3 flex items-center gap-2 text-sm">
            <div className="flex-1">
              <div className="font-semibold">{u.name}</div>
              <div className="text-zinc-500 text-xs">Live: {u.live_points ?? 0} · Strat: {u.strategy_points ?? 0}</div>
            </div>
            <input id={`strat-${u.id}`} type="number" defaultValue={u.strategy_points ?? 0}
              className="w-24 bg-[#0A0A0A] border border-white/10 text-center py-1" data-testid={`strat-input-${u.id}`} />
            <button data-testid={`strat-save-${u.id}`} onClick={() => save(u)}
              className="bg-[#39FF14] text-black font-bold px-3 py-1 text-xs uppercase tracking-widest">Spara</button>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------- Hall of Fame admin ----------
function HallOfFameTab() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ year: "", winner_name: "", winner_points: "", second_name: "", second_points: "", third_name: "", third_points: "" });
  const [msg, setMsg] = useState("");
  const load = async () => setRows((await api.get("/hall-of-fame")).data);
  useEffect(() => { load(); }, []);
  const submit = async () => {
    try {
      await api.post("/hall-of-fame", {
        year: parseInt(form.year),
        winner_name: form.winner_name, winner_points: parseInt(form.winner_points),
        second_name: form.second_name, second_points: parseInt(form.second_points),
        third_name: form.third_name, third_points: parseInt(form.third_points),
      });
      setMsg("Sparat"); setForm({ year: "", winner_name: "", winner_points: "", second_name: "", second_points: "", third_name: "", third_points: "" });
      load();
    } catch (e) { setMsg(formatError(e)); }
  };
  const del = async (year) => {
    if (!window.confirm(`Ta bort år ${year} från Hall of Fame?`)) return;
    await api.delete(`/hall-of-fame/${year}`); load();
  };
  return (
    <div className="space-y-3">
      <Section title="Lägg till år i Hall of Fame">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <input data-testid="hof-year" type="number" placeholder="År (t.ex. 2022)" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2" />
          <input data-testid="hof-winner-name" placeholder="Vinnare namn" value={form.winner_name} onChange={(e) => setForm({ ...form, winner_name: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2 col-span-2" />
          <input data-testid="hof-winner-pts" type="number" placeholder="Vinnare poäng" value={form.winner_points} onChange={(e) => setForm({ ...form, winner_points: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2" />
          <input data-testid="hof-second-name" placeholder="2:a namn" value={form.second_name} onChange={(e) => setForm({ ...form, second_name: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2 col-span-2" />
          <input data-testid="hof-second-pts" type="number" placeholder="2:a poäng" value={form.second_points} onChange={(e) => setForm({ ...form, second_points: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2" />
          <input data-testid="hof-third-name" placeholder="3:e namn" value={form.third_name} onChange={(e) => setForm({ ...form, third_name: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2 col-span-2" />
          <input data-testid="hof-third-pts" type="number" placeholder="3:e poäng" value={form.third_points} onChange={(e) => setForm({ ...form, third_points: e.target.value })} className="bg-[#0A0A0A] border border-white/10 p-2" />
          <button data-testid="hof-submit" onClick={submit} className="bg-[#00F0FF] text-black font-bold px-3 py-2 uppercase tracking-widest col-span-2">Spara</button>
        </div>
        {msg && <div className="text-[#39FF14] text-sm mt-2">{msg}</div>}
      </Section>
      <Section title={`Befintliga år (${rows.length})`}>
        {rows.length === 0 ? <div className="text-zinc-500 text-sm">Inget i Hall of Fame ännu.</div> :
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.year} className="border border-white/10 p-3 text-sm flex items-center justify-between">
                <div><span className="font-display font-black text-xl">{r.year}</span> · 🥇 {r.winner_name} ({r.winner_points}) · 🥈 {r.second_name} ({r.second_points}) · 🥉 {r.third_name} ({r.third_points})</div>
                <button onClick={() => del(r.year)} className="text-zinc-500 hover:text-[#FF3B30]"><Trash size={14} /></button>
              </div>
            ))}
          </div>}
      </Section>
    </div>
  );
}

// ---------- Audit ----------
function AuditTab() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { (async () => setLogs((await api.get("/admin/audit-log")).data))(); }, []);
  return (
    <Section title="Aktivitetslogg">
      <div className="space-y-2 text-xs">
        {logs.length === 0 && <div className="text-zinc-500">Ingen aktivitet ännu.</div>}
        {logs.map((l) => (
          <div key={l.id} className="border border-white/10 p-2" data-testid={`audit-${l.id}`}>
            <div className="flex items-center justify-between">
              <span className="text-[#00F0FF] font-mono">{l.action}</span>
              <span className="text-zinc-500">{fmtSwedishCompact(l.timestamp)}</span>
            </div>
            <div className="text-zinc-400">av {l.admin_name || l.admin_email}</div>
            {l.details && Object.keys(l.details).length > 0 && (
              <div className="text-zinc-500 mt-1 font-mono break-all">{JSON.stringify(l.details)}</div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("results");
  return (
    <div className="space-y-4">
      <div>
        <div className="label-eyebrow">Kontrollrum</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Adminpanel</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} data-testid={`admin-tab-${t.id}`} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs uppercase tracking-widest font-bold border ${
              tab === t.id ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 text-zinc-400 hover:text-white"
            }`}>{t.label}</button>
        ))}
      </div>
      {tab === "results" && <ResultsTab />}
      {tab === "teams" && <TeamsTab />}
      {tab === "import" && <ImportTab />}
      {tab === "deadlines" && <DeadlinesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "invites" && <InvitesTab />}
      {tab === "scoring" && <ScoringTab />}
      {tab === "halloffame" && <HallOfFameTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
