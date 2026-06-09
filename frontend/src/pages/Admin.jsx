import React, { useEffect, useState } from "react";
import { api, formatError } from "../lib/api";
import { FlagTeam } from "../components/FlagTeam";
import { UserPlus, Trash, ShieldCheck, ShieldChevron, Plus, ArrowsClockwise } from "@phosphor-icons/react";

function Section({ title, children, action }) {
  return (
    <section className="surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("matches");
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // Match form
  const [mform, setMform] = useState({
    stage: "group", group: "A", home_team_id: "", away_team_id: "", kickoff: "",
  });

  const load = async () => {
    setErr("");
    try {
      const [u, i, m, t] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/invites"),
        api.get("/matches"),
        api.get("/teams"),
      ]);
      setUsers(u.data); setInvites(i.data); setMatches(m.data); setTeams(t.data);
    } catch (e) {
      setErr(formatError(e));
    }
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (u) => {
    const role = u.role === "admin" ? "user" : "admin";
    await api.put(`/admin/users/${u.id}/role`, { role });
    setMsg(`${u.name} is now ${role}`);
    load();
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    load();
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    try {
      await api.post("/admin/invite", { email: inviteEmail });
      setInviteEmail(""); setMsg("Invite added"); load();
    } catch (e) { setErr(formatError(e)); }
  };

  const removeInvite = async (email) => {
    await api.delete(`/admin/invites/${encodeURIComponent(email)}`);
    load();
  };

  const createMatch = async () => {
    setErr("");
    try {
      const kickoff = new Date(mform.kickoff).toISOString();
      await api.post("/matches", { ...mform, kickoff });
      setMsg("Match created"); load();
    } catch (e) { setErr(formatError(e)); }
  };

  const deleteMatch = async (id) => {
    if (!window.confirm("Delete match?")) return;
    await api.delete(`/matches/${id}`);
    load();
  };

  const setResult = async (id, h, a) => {
    await api.put(`/matches/${id}/result`, { home_score: parseInt(h), away_score: parseInt(a) });
    setMsg("Result saved + points recomputed"); load();
  };

  const recompute = async () => {
    await api.post("/admin/recompute");
    setMsg("Live points recomputed");
  };

  const setStrat = async (uid, pts) => {
    await api.post("/admin/strategy-points", { user_id: uid, points: parseInt(pts || 0) });
    setMsg("Strategy points saved"); load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="label-eyebrow">Control Room</div>
        <h1 className="font-display font-black text-3xl tracking-tighter">Admin Panel</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {["matches", "users", "invites", "scoring"].map((t) => (
          <button
            key={t}
            data-testid={`admin-tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs uppercase tracking-widest font-bold border ${
              tab === t ? "bg-[#00F0FF] text-black border-[#00F0FF]" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {err && <div className="text-[#FF3B30] text-sm">{err}</div>}
      {msg && <div className="text-[#39FF14] text-sm">{msg}</div>}

      {tab === "matches" && (
        <>
          <Section title="Create Match">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              <select data-testid="m-stage" className="bg-[#0A0A0A] border border-white/10 p-2" value={mform.stage} onChange={(e) => setMform({ ...mform, stage: e.target.value })}>
                <option value="group">Group</option>
                <option value="r32">R32</option>
                <option value="r16">R16</option>
                <option value="qf">QF</option>
                <option value="sf">SF</option>
                <option value="final">Final</option>
              </select>
              <input data-testid="m-group" className="bg-[#0A0A0A] border border-white/10 p-2" placeholder="Group" value={mform.group} onChange={(e) => setMform({ ...mform, group: e.target.value })} />
              <select data-testid="m-home" className="bg-[#0A0A0A] border border-white/10 p-2 col-span-2" value={mform.home_team_id} onChange={(e) => setMform({ ...mform, home_team_id: e.target.value })}>
                <option value="">Home team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
              <select data-testid="m-away" className="bg-[#0A0A0A] border border-white/10 p-2 col-span-2" value={mform.away_team_id} onChange={(e) => setMform({ ...mform, away_team_id: e.target.value })}>
                <option value="">Away team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
              </select>
              <input data-testid="m-kickoff" type="datetime-local" className="bg-[#0A0A0A] border border-white/10 p-2 col-span-3" value={mform.kickoff} onChange={(e) => setMform({ ...mform, kickoff: e.target.value })} />
              <button data-testid="m-create" onClick={createMatch} className="bg-[#00F0FF] text-black font-bold px-4 py-2 inline-flex items-center justify-center gap-1 col-span-3">
                <Plus size={16} weight="bold" /> Create
              </button>
            </div>
          </Section>

          <Section title={`Matches (${matches.length})`} action={
            <button data-testid="recompute-btn" onClick={recompute} className="text-xs uppercase tracking-widest text-[#00F0FF] inline-flex items-center gap-1 hover:underline">
              <ArrowsClockwise size={14} /> Recompute Live Pts
            </button>
          }>
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="border border-white/10 p-3 text-sm" data-testid={`admin-match-${m.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 grid grid-cols-7 items-center gap-2">
                      <div className="col-span-3"><FlagTeam team={m.home_team} size={18} /></div>
                      <div className="text-center text-zinc-500">vs</div>
                      <div className="col-span-3 flex justify-end"><FlagTeam team={m.away_team} size={18} reverse /></div>
                    </div>
                    <button onClick={() => deleteMatch(m.id)} className="text-zinc-500 hover:text-[#FF3B30]" data-testid={`del-match-${m.id}`}>
                      <Trash size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="label-eyebrow text-zinc-500">{new Date(m.kickoff).toLocaleString()}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <input data-testid={`res-h-${m.id}`} type="number" min={0} defaultValue={m.home_score ?? ""} className="w-12 bg-[#0A0A0A] border border-white/10 text-center py-1" id={`h-${m.id}`} />
                      <span>:</span>
                      <input data-testid={`res-a-${m.id}`} type="number" min={0} defaultValue={m.away_score ?? ""} className="w-12 bg-[#0A0A0A] border border-white/10 text-center py-1" id={`a-${m.id}`} />
                      <button data-testid={`res-save-${m.id}`} onClick={() => {
                        const h = document.getElementById(`h-${m.id}`).value;
                        const a = document.getElementById(`a-${m.id}`).value;
                        setResult(m.id, h, a);
                      }} className="bg-[#39FF14] text-black font-bold px-3 py-1 text-xs uppercase tracking-widest">
                        Save Result
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === "users" && (
        <Section title={`Users (${users.length})`}>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="border border-white/10 p-3 flex items-center justify-between text-sm" data-testid={`admin-user-${u.id}`}>
                <div>
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-zinc-500 text-xs">{u.email} · {u.role}</div>
                </div>
                <div className="flex gap-2">
                  <button data-testid={`role-toggle-${u.id}`} onClick={() => toggleRole(u)} className="text-xs uppercase tracking-widest border border-white/10 px-2 py-1 hover:border-[#00F0FF] hover:text-[#00F0FF] inline-flex items-center gap-1">
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
      )}

      {tab === "invites" && (
        <Section title={`Invites (${invites.length})`}>
          <div className="flex gap-2 mb-3">
            <input
              data-testid="invite-email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@family.com"
              className="flex-1 bg-[#0A0A0A] border border-white/10 px-3 py-2 text-sm"
            />
            <button data-testid="invite-add" onClick={sendInvite} className="bg-[#00F0FF] text-black font-bold px-3 py-2 inline-flex items-center gap-1">
              <UserPlus size={16} /> Invite
            </button>
          </div>
          <div className="divide-y divide-white/10">
            {invites.length === 0 && <div className="text-zinc-500 text-sm py-3">No pending invites.</div>}
            {invites.map((i) => (
              <div key={i.email} className="flex items-center justify-between py-2 text-sm" data-testid={`invite-${i.email}`}>
                <span>{i.email}</span>
                <button onClick={() => removeInvite(i.email)} className="text-zinc-500 hover:text-[#FF3B30]">
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "scoring" && (
        <Section title="Strategy Points (manual override)">
          <p className="text-zinc-500 text-xs mb-3">After each tournament stage settles, set each player's strategy points based on the version multipliers.</p>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="border border-white/10 p-3 flex items-center gap-2 text-sm">
                <div className="flex-1">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-zinc-500 text-xs">Live: {u.live_points ?? 0} · Strat: {u.strategy_points ?? 0}</div>
                </div>
                <input id={`strat-${u.id}`} type="number" defaultValue={u.strategy_points ?? 0} className="w-24 bg-[#0A0A0A] border border-white/10 text-center py-1" data-testid={`strat-input-${u.id}`} />
                <button data-testid={`strat-save-${u.id}`} onClick={() => setStrat(u.id, document.getElementById(`strat-${u.id}`).value)} className="bg-[#39FF14] text-black font-bold px-3 py-1 text-xs uppercase tracking-widest">
                  Save
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
