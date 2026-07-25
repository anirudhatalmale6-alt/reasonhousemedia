import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { useAuth } from "../auth";

const ROLE_LABEL = { admin: "Super admin", subadmin: "Sub-admin" };

export default function TeamManager() {
  const { user } = useAuth();
  const [team, setTeam] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "", password: "", role: "subadmin" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.team().then(setTeam).catch(() => {});
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await api.addTeam(form);
      setForm({ display_name: "", email: "", password: "", role: "subadmin" });
      setOpen(false); load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function changeRole(m, role) { await api.setTeamRole(m.id, role); load(); }
  async function remove(m) {
    if (!confirm(`Revoke admin access for ${m.display_name}?`)) return;
    try { await api.removeTeam(m.id); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="admin-panel" style={{ marginTop: 22 }}>
      <div className="admin-panel-head">
        <span>🛡️ Admin team · {team.length} members</span>
        <button className="btn" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "＋ New admin"}</button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.form className="add-cat" style={{ marginBottom: 16 }} onSubmit={create}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <input placeholder="Full name" value={form.display_name} onChange={set("display_name")} required />
            <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
            <input type="password" placeholder="Password (min 6)" value={form.password} onChange={set("password")} required minLength={6} />
            <select value={form.role} onChange={set("role")} className="role-select">
              <option value="subadmin">Sub-admin (manage content)</option>
              <option value="admin">Super admin (full control)</option>
            </select>
            <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
            {err && <span className="form-err" style={{ margin: 0 }}>{err}</span>}
          </motion.form>
        )}
      </AnimatePresence>

      <div className="team-list">
        {team.map((m) => (
          <div className="team-row" key={m.id}>
            <div className={`role-badge ${m.role}`}>{ROLE_LABEL[m.role]}</div>
            <div className="team-main">
              <div className="name">{m.display_name}{m.id === user.id && <span className="you-tag">you</span>}</div>
              <div className="handle">{m.email}</div>
            </div>
            {m.id !== user.id && (
              <div className="admin-row-actions">
                {m.role === "subadmin" ? (
                  <button className="mini-btn" onClick={() => changeRole(m, "admin")}>Promote</button>
                ) : (
                  <button className="mini-btn" onClick={() => changeRole(m, "subadmin")}>Demote</button>
                )}
                <button className="mini-btn danger" onClick={() => remove(m)}>Revoke</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
