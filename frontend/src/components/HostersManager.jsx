import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { api, mediaUrl } from "../api";

function Item({ user, index, onRemove }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={user} dragListener={false} dragControls={controls} className="admin-row">
      <span className="drag-handle" onPointerDown={(e) => controls.start(e)} title="Drag to reorder">⠿</span>
      <div className={`rank r${index + 1}`}>{index + 1}</div>
      <div className="avatar" style={{ backgroundImage: `url(${mediaUrl(user.photo) || `https://i.pravatar.cc/120?u=${user.id}`})` }} />
      <div className="admin-row-main">
        <div className="name">{user.display_name}</div>
        <div className="handle">{user.tiktok_handle} · {user.events_hosted || 0} events</div>
      </div>
      <div className="admin-row-actions">
        <button className="mini-btn danger" onClick={() => onRemove(user)}>Remove</button>
      </div>
    </Reorder.Item>
  );
}

export default function HostersManager() {
  const [hosters, setHosters] = useState([]);
  const [users, setUsers] = useState([]);
  const [addId, setAddId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    api.hosters().then(setHosters).catch(() => {});
    api.allUsers().then(setUsers).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  function onReorder(next) { setHosters(next); setDirty(true); setSaved(false); }
  async function save() {
    await api.reorderHosters(hosters.map((u) => u.id));
    setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  async function add() {
    if (!addId) return;
    await api.addHoster(Number(addId)); setAddId(""); load();
  }
  async function remove(u) { await api.removeHoster(u.id); setHosters((h) => h.filter((x) => x.id !== u.id)); }

  const notHoster = users.filter((u) => !hosters.some((h) => h.id === u.id));

  return (
    <div className="admin-panel" style={{ marginTop: 22 }}>
      <div className="admin-panel-head">
        <span>🎙️ Top Hosters · {hosters.length}</span>
        <button className="btn" disabled={!dirty} onClick={save}>{saved ? "Saved ✓" : dirty ? "Save order" : "No changes"}</button>
      </div>

      <div className="assign-row">
        <select value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">＋ Make a creator a hoster…</option>
          {notHoster.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({u.tiktok_handle})</option>)}
        </select>
        <button className="btn ghost" onClick={add} disabled={!addId}>Add hoster</button>
      </div>

      {hosters.length === 0 ? (
        <p style={{ color: "var(--muted)", padding: 8 }}>No hosters yet — add one above, or people can sign up as hosters.</p>
      ) : (
        <Reorder.Group axis="y" values={hosters} onReorder={onReorder} className="admin-list">
          {hosters.map((u, i) => <Item key={u.id} user={u} index={i} onRemove={remove} />)}
        </Reorder.Group>
      )}
    </div>
  );
}
