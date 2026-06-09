import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { FlagTeam, Flag } from "../components/FlagTeam";
import {
  UserPlus, Trash, ShieldCheck, ShieldChevron, ArrowsClockwise,
  UploadSimple, Warning, CheckCircle, ClipboardText, CalendarBlank, Prohibit, Recycle,
} from "@phosphor-icons/react";

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
  { id: "results", label: "Results" },
  { id: "teams", label: "Teams / DQ" },
  { id: "import", label: "Import" },
  { id: "deadline", label: "V1 Deadline" },
  { id: "users", label: "Users" },
  { id: "invites", label: "Invites" },
  { id: "scoring", label: "Scoring" },
  { id: "audit", label: "Audit Log" },
];

function ResultsTab() {
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState("all");
  const [stage, setStage] = useState("all");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await api.get("/matches");
    setMatches(data);
  };
  useEffect(() => { load(); }, []);

  const setResult = async (m, h, a) => {
    await api.put(`/matches/${m.id}/result`, { home_score: parseInt(h), away_score: parseInt(a) });
    setMsg(`Saved · #${m.match_number || ""}. Standings + bracket + points recomputed.`);
    load();
  };
  const clearResult = async (m) => {
    if (!window.confirm("Clear this result and recompute?")) return;
    await api.delete(`/matches/${m.id}/result`);
    setMsg(`Cleared #${m.match_number}`); load();
  };
  const progress = async () => {
    await api.post("/admin/progress");
    setMsg("Tournament progression executed."); load();
  };
  const recompute = async () => {
    await api.post("/admin/recompute");
    setMsg("All points recomputed."); load();
  };

  const filtered = matches.filter((m) => {
    if (filter === "with-result" && m.status !== "finished") return false;
    if (filter === "no-result" && m.status === "finished") return false;
    if (stage === "group" && m.stage !== "Group Stage") return false;
    if (stage === "knockout" && m.stage !== "Knockout") return false;
    return true;
  });

  return (
    <div className="space-y-3">
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}
      <div className="flex gap-2 flex-wrap">
        {["all", "no-result", "with-result"].map((f) => (
          <button key={f} data-testid={`res-filter-${f}`} onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs uppercase tracking-widest font-bold border ${
              filter === f ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 text-zinc-400"
            }`}>{f}</button>
        ))}
        <span className="text-zinc-700 mx-1">|</span>
        {["all", "group", "knockout"].map((s) => (
          <button key={s} data-testid={`res-stage-${s}`} onClick={() => setStage(s)}
            className={`px-3 py-1 text-xs uppercase tracking-widest font-bold border ${
              stage === s ? "bg-[#39FF14] text-black border-[#39FF14]" : "border-white/10 text-zinc-400"
            }`}>{s}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <button data-testid="progress-btn" onClick={progress}
            className="text-xs uppercase tracking-widest border border-white/10 text-[#FFCC00] px-3 py-1 inline-flex items-center gap-1 hover:bg-[#FFCC00]/10">
            <Recycle size={14} /> Progress Bracket
          </button>
          <button data-testid="recompute-btn" onClick={recompute}
            className="text-xs uppercase tracking-widest border border-white/10 text-[#00F0FF] px-3 py-1 inline-flex items-center gap-1 hover:bg-[#00F0FF]/10">
            <ArrowsClockwise size={14} /> Recompute Points
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((m) => (
          <div key={m.id} className="surface p-3 text-sm" data-testid={`res-row-${m.id}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="bg-[#1C1C1C] border border-white/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">#{m.match_number}</span>
                <span className="label-eyebrow">{m.round || m.stage}</span>
                {m.group && <span className="label-eyebrow text-[#00F0FF]">G {m.group}</span>}
              </div>
              <span className="text-[10px] text-zinc-500">{new Date(m.kickoff).toLocaleString()}</span>
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
                  if (h === "" || a === "") return alert("Enter both scores");
                  setResult(m, h, a);
                }}
                className="bg-[#39FF14] text-black font-bold px-3 py-1 text-xs uppercase tracking-widest">Save</button>
              {m.status === "finished" && (
                <button data-testid={`res-clear-${m.id}`} onClick={() => clearResult(m)}
                  className="text-[#FF3B30] text-xs uppercase tracking-widest border border-white/10 px-2 py-1 inline-flex items-center gap-1">
                  <Trash size={12} /> Clear
                </button>
              )}
              {m.status === "finished" && (
                <span className="ml-auto text-[#39FF14] inline-flex items-center gap-1 text-xs">
                  <CheckCircle size={14} weight="fill" /> Finished
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [reason, setReason] = useState({});
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await api.get("/teams");
    setTeams(data);
  };
  useEffect(() => { load(); }, []);

  const dq = async (t) => {
    const r = reason[t.id];
    if (!r || !r.trim()) return alert("Reason is required");
    if (!window.confirm(`Disqualify ${t.team_name}? Reason: ${r}`)) return;
    try {
      await api.post("/admin/teams/disqualify", { team_id: t.id, reason: r });
      setMsg(`${t.team_name} disqualified`); load();
    } catch (e) { setMsg(formatError(e)); }
  };
  const reinstate = async (t) => {
    if (!window.confirm(`Reinstate ${t.team_name}?`)) return;
    await api.post(`/admin/teams/${t.id}/reinstate`);
    setMsg(`${t.team_name} reinstated`); load();
  };

  // Group by group letter
  const groups = {};
  teams.forEach((t) => { groups[t.group] = groups[t.group] || []; groups[t.group].push(t); });

  return (
    <div className="space-y-3">
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}
      <p className="text-zinc-500 text-xs">Disqualifying a team auto-updates standings, knockout progression, predictions and strategy points. An audit entry is recorded.</p>
      {Object.keys(groups).sort().map((g) => (
        <div key={g} className="surface p-3">
          <div className="label-eyebrow mb-2">Group {g}</div>
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
                      <CheckCircle size={12} /> Reinstate
                    </button>
                  </>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <input data-testid={`dq-reason-${t.id}`} value={reason[t.id] || ""} onChange={(e) => setReason((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Reason…" className="bg-[#0A0A0A] border border-white/10 px-2 py-1 text-xs w-40" />
                    <button data-testid={`dq-${t.id}`} onClick={() => dq(t)} className="text-xs text-[#FF3B30] border border-[#FF3B30] px-2 py-1 uppercase tracking-widest inline-flex items-center gap-1">
                      <Prohibit size={12} /> DQ
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
    if (!window.confirm("This will REPLACE all current teams + fixtures with the file's data. Proceed?")) return;
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
      <Section title="Excel / CSV Import">
        <p className="text-zinc-500 text-xs mb-3">Upload the VM2026 fixture file (.xlsx). Preview first, then commit. Existing fixtures will be replaced.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".xlsx,.xls" data-testid="import-file"
            onChange={(e) => setFile(e.target.files[0])} className="text-sm" />
          <button data-testid="import-preview-btn" disabled={!file || busy} onClick={doPreview}
            className="bg-[#00F0FF] text-black font-bold px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1">
            <ClipboardText size={14} /> Preview
          </button>
          <button data-testid="import-commit-btn" disabled={!preview || busy} onClick={doCommit}
            className="bg-[#39FF14] text-black font-bold px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1">
            <UploadSimple size={14} weight="bold" /> Replace & Import
          </button>
        </div>
        {err && <div className="text-[#FF3B30] text-sm mt-3 inline-flex items-center gap-1"><Warning size={14} /> {err}</div>}
      </Section>

      {preview && (
        <Section title="Preview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Teams</div><div className="font-display font-black text-2xl">{preview.summary.teams_count}</div></div>
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Matches</div><div className="font-display font-black text-2xl">{preview.summary.matches_count}</div></div>
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Group</div><div className="font-display font-black text-2xl text-[#00F0FF]">{preview.summary.group_matches}</div></div>
            <div className="border border-white/10 p-3"><div className="label-eyebrow">Knockout</div><div className="font-display font-black text-2xl text-[#39FF14]">{preview.summary.knockout_matches}</div></div>
          </div>
          <div className="mt-3 text-xs text-zinc-400">Groups: {preview.summary.groups_detected.join(", ")}</div>
          {preview.summary.duplicates.length > 0 && <div className="text-[#FFCC00] text-xs mt-2">Duplicates: {preview.summary.duplicates.join(", ")}</div>}
          {preview.summary.errors.length > 0 && <div className="text-[#FF3B30] text-xs mt-2">Errors: {preview.summary.errors.join("; ")}</div>}
        </Section>
      )}

      {result && (
        <Section title="Import Result">
          <div className="text-[#39FF14] text-sm inline-flex items-center gap-1"><CheckCircle size={14} weight="fill" /> Imported {result.teams_inserted} teams, {result.matches_inserted} matches.</div>
          <div className="text-zinc-400 text-xs mt-2">Groups detected: {result.summary?.groups_detected?.join(", ")} · Group matches: {result.summary?.group_matches} · Knockout: {result.summary?.knockout_matches}</div>
        </Section>
      )}
    </div>
  );
}

function DeadlineTab() {
  const [deadline, setDeadline] = useState("");
  const [current, setCurrent] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await api.get("/config/v1-deadline");
    setCurrent(data.deadline);
    if (data.deadline) {
      const d = new Date(data.deadline);
      setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const iso = new Date(deadline).toISOString();
    await api.post("/config/v1-deadline", { deadline: iso });
    setMsg("V1 deadline updated"); load();
  };

  return (
    <Section title="Version 1 Submission Deadline">
      <p className="text-zinc-500 text-xs mb-3">After this timestamp, V1 tournament submissions will be flagged as LATE for everyone.</p>
      <div className="flex gap-2 items-center flex-wrap">
        <input type="datetime-local" data-testid="deadline-input" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="bg-[#0A0A0A] border border-white/10 px-3 py-2 text-sm" />
        <button data-testid="deadline-save" onClick={save} disabled={!deadline}
          className="bg-[#00F0FF] text-black font-bold px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1">
          <CalendarBlank size={14} /> Save Deadline
        </button>
      </div>
      {current && <div className="mt-3 text-xs text-zinc-400">Current: {new Date(current).toLocaleString()}</div>}
      {msg && <div className="text-[#39FF14] text-sm mt-2">{msg}</div>}
    </Section>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");
  const load = async () => setUsers((await api.get("/admin/users")).data);
  useEffect(() => { load(); }, []);
  const toggleRole = async (u) => {
    await api.put(`/admin/users/${u.id}/role`, { role: u.role === "admin" ? "user" : "admin" });
    setMsg(`${u.name} role updated`); load();
  };
  const removeUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    await api.delete(`/admin/users/${u.id}`); load();
  };
  return (
    <Section title={`Users (${users.length})`}>
      {msg && <div className="text-[#39FF14] text-sm mb-2">{msg}</div>}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="border border-white/10 p-3 flex items-center justify-between text-sm" data-testid={`admin-user-${u.id}`}>
            <div>
              <div className="font-semibold">{u.name}</div>
              <div className="text-zinc-500 text-xs">{u.email} · {u.role}</div>
            </div>
            <div className="flex gap-2">
              <button data-testid={`role-toggle-${u.id}`} onClick={() => toggleRole(u)}
                className="text-xs uppercase tracking-widest border border-white/10 px-2 py-1 hover:border-[#00F0FF] hover:text-[#00F0FF] inline-flex items-center gap-1">
                {u.role === "admin" ? <ShieldChevron size={14} /> : <ShieldCheck size={14} />}
                {u.role === "admin" ? "Demote" : "Promote"}
              </button>
              <button data-testid={`del-user-${u.id}`} onClick={() => removeUser(u)} className="text-zinc-500 hover:text-[#FF3B30]">
                <Trash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function InvitesTab() {
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const load = async () => setInvites((await api.get("/admin/invites")).data);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!email) return;
    try { await api.post("/admin/invite", { email }); setEmail(""); setMsg("Invite added"); load(); }
    catch (e) { setMsg(formatError(e)); }
  };
  const remove = async (e) => { await api.delete(`/admin/invites/${encodeURIComponent(e)}`); load(); };
  return (
    <Section title={`Invites (${invites.length})`}>
      <div className="flex gap-2 mb-3">
        <input data-testid="invite-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@family.com"
          className="flex-1 bg-[#0A0A0A] border border-white/10 px-3 py-2 text-sm" />
        <button data-testid="invite-add" onClick={add} className="bg-[#00F0FF] text-black font-bold px-3 py-2 inline-flex items-center gap-1">
          <UserPlus size={16} /> Invite
        </button>
      </div>
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}
      <div className="divide-y divide-white/10">
        {invites.length === 0 && <div className="text-zinc-500 text-sm py-3">No pending invites.</div>}
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

function ScoringTab() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");
  const load = async () => setUsers((await api.get("/admin/users")).data);
  useEffect(() => { load(); }, []);
  const save = async (u) => {
    const val = document.getElementById(`strat-${u.id}`).value;
    await api.post("/admin/strategy-points", { user_id: u.id, points: parseInt(val || 0) });
    setMsg("Saved"); load();
  };
  return (
    <Section title="Strategy Points (manual override)">
      <p className="text-zinc-500 text-xs mb-3">Auto-calculated from tournament predictions, but you can manually override.</p>
      {msg && <div className="text-[#39FF14] text-sm mb-2">{msg}</div>}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="border border-white/10 p-3 flex items-center gap-2 text-sm">
            <div className="flex-1">
              <div className="font-semibold">{u.name}</div>
              <div className="text-zinc-500 text-xs">Live: {u.live_points ?? 0} · Strat: {u.strategy_points ?? 0}</div>
            </div>
            <input id={`strat-${u.id}`} type="number" defaultValue={u.strategy_points ?? 0}
              className="w-24 bg-[#0A0A0A] border border-white/10 text-center py-1" data-testid={`strat-input-${u.id}`} />
            <button data-testid={`strat-save-${u.id}`} onClick={() => save(u)}
              className="bg-[#39FF14] text-black font-bold px-3 py-1 text-xs uppercase tracking-widest">Save</button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { (async () => setLogs((await api.get("/admin/audit-log")).data))(); }, []);
  return (
    <Section title="Audit Log">
      <div className="space-y-2 text-xs">
        {logs.length === 0 && <div className="text-zinc-500">No activity yet.</div>}
        {logs.map((l) => (
          <div key={l.id} className="border border-white/10 p-2" data-testid={`audit-${l.id}`}>
            <div className="flex items-center justify-between">
              <span className="text-[#00F0FF] font-mono">{l.action}</span>
              <span className="text-zinc-500">{new Date(l.timestamp).toLocaleString()}</span>
            </div>
            <div className="text-zinc-400">by {l.admin_name || l.admin_email}</div>
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
        <div className="label-eyebrow">Control Room</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Admin Panel</h1>
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
      {tab === "deadline" && <DeadlineTab />}
      {tab === "users" && <UsersTab />}
      {tab === "invites" && <InvitesTab />}
      {tab === "scoring" && <ScoringTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}
