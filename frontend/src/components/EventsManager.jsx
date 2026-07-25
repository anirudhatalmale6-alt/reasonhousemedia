import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";

function MatchupEditor({ m, users, onSet, onDelete, canDelete }) {
  const a = m.a, b = m.b;
  return (
    <div className="am-matchup">
      <div className="am-fighters">
        <button className={`am-fighter ${m.winner_id === a?.id ? "win" : ""}`} onClick={() => onSet(m.id, a?.id)}>
          <div className="avatar" style={{ backgroundImage: `url(${mediaUrl(a?.photo) || `https://i.pravatar.cc/80?u=${a?.id}`})` }} />
          <span>{a?.display_name}</span>
          {m.winner_id === a?.id && <b className="w">W</b>}
        </button>
        <span className="am-vs">VS</span>
        <button className={`am-fighter ${m.winner_id === b?.id ? "win" : ""}`} onClick={() => onSet(m.id, b?.id)}>
          <div className="avatar" style={{ backgroundImage: `url(${mediaUrl(b?.photo) || `https://i.pravatar.cc/80?u=${b?.id}`})` }} />
          <span>{b?.display_name}</span>
          {m.winner_id === b?.id && <b className="w">W</b>}
        </button>
      </div>
      <div className="am-actions">
        {m.title && <span className="am-tag">{m.title}</span>}
        {m.winner_id && <button className="mini-btn" onClick={() => onSet(m.id, null)}>Clear result</button>}
        {canDelete && <button className="mini-btn danger" onClick={() => onDelete(m.id)}>Delete</button>}
      </div>
    </div>
  );
}

function EventCard({ ev, users, reload, canDelete }) {
  const [addA, setAddA] = useState("");
  const [addB, setAddB] = useState("");
  const [mtitle, setMtitle] = useState("");
  const [method, setMethod] = useState("");

  async function addMatchup() {
    if (!addA || !addB) return;
    await api.addMatchup(ev.id, { a_user_id: Number(addA), b_user_id: Number(addB), title: mtitle, method });
    setAddA(""); setAddB(""); setMtitle(""); setMethod(""); reload();
  }
  async function setWinner(mid, uid) { await api.updateMatchup(mid, { winner_id: uid }); reload(); }
  async function delMatchup(mid) { await api.deleteMatchup(mid); reload(); }
  async function toggleStatus() {
    await api.updateEvent(ev.id, { status: ev.status === "completed" ? "upcoming" : "completed" });
    reload();
  }
  async function delEvent() { if (confirm(`Delete event "${ev.title}"?`)) { await api.deleteEvent(ev.id); reload(); } }

  return (
    <div className="am-event">
      <div className="am-event-head">
        <div>
          <b>{ev.title}</b> <span className={`event-status ${ev.status}`}>{ev.status === "completed" ? "Past" : "Upcoming"}</span>
          {ev.event_date && <span className="event-date"> · {ev.event_date}</span>}
          {ev.host && <span className="event-date"> · 🎙️ {ev.host.display_name}</span>}
        </div>
        <div className="admin-row-actions">
          <button className="mini-btn" onClick={toggleStatus}>{ev.status === "completed" ? "Mark upcoming" : "Mark past"}</button>
          {canDelete && <button className="mini-btn danger" onClick={delEvent}>Delete event</button>}
        </div>
      </div>

      {ev.matchups.map((m) => (
        <MatchupEditor key={m.id} m={m} users={users} onSet={setWinner} onDelete={delMatchup} canDelete={canDelete} />
      ))}

      <div className="am-add-matchup">
        <select value={addA} onChange={(e) => setAddA(e.target.value)}>
          <option value="">Creator A…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
        <span className="am-vs">vs</span>
        <select value={addB} onChange={(e) => setAddB(e.target.value)}>
          <option value="">Creator B…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
        <input placeholder="Label (e.g. Main event)" value={mtitle} onChange={(e) => setMtitle(e.target.value)} />
        <input placeholder="Method (e.g. Vote)" value={method} onChange={(e) => setMethod(e.target.value)} />
        <button className="btn ghost" onClick={addMatchup} disabled={!addA || !addB}>Add matchup</button>
      </div>
    </div>
  );
}

export default function EventsManager() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin";
  const [data, setData] = useState({ upcoming: [], past: [] });
  const [users, setUsers] = useState([]);
  const [hosters, setHosters] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [hostId, setHostId] = useState("");

  const reload = () => api.events().then(setData).catch(() => {});
  useEffect(() => {
    reload();
    api.allUsers().then(setUsers).catch(() => {});
    api.hosters().then(setHosters).catch(() => {});
  }, []);

  async function createEvent() {
    if (!title.trim()) return;
    await api.addEvent({ title, event_date: date, host_id: hostId ? Number(hostId) : null });
    setTitle(""); setDate(""); setHostId(""); setOpen(false); reload();
  }

  const all = [...data.upcoming, ...data.past];

  return (
    <div className="admin-panel" style={{ marginTop: 22 }}>
      <div className="admin-panel-head">
        <span>🥊 Events · {all.length}</span>
        <button className="btn" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "＋ New event"}</button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="add-cat" style={{ marginBottom: 16 }}
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <input placeholder="Event title (e.g. Friday Night Clash)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input placeholder="Date (e.g. Aug 2, 9:00 PM)" value={date} onChange={(e) => setDate(e.target.value)} />
            <select value={hostId} onChange={(e) => setHostId(e.target.value)} className="role-select">
              <option value="">Host (optional)…</option>
              {hosters.map((h) => <option key={h.id} value={h.id}>🎙️ {h.display_name}</option>)}
            </select>
            <button className="btn" onClick={createEvent}>Create event</button>
          </motion.div>
        )}
      </AnimatePresence>

      {all.length === 0 && <p style={{ color: "var(--muted)", padding: 8 }}>No events yet — create one above, then add head-to-head matchups.</p>}
      {all.map((ev) => <EventCard key={ev.id} ev={ev} users={users} reload={reload} canDelete={canDelete} />)}
    </div>
  );
}
