import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Reorder, useDragControls } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";

function Handle({ controls }) {
  return (
    <span className="drag-handle" onPointerDown={(e) => controls.start(e)} title="Drag to reorder">⠿</span>
  );
}

function Item({ user, index }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={user} dragListener={false} dragControls={controls} className="admin-row">
      <Handle controls={controls} />
      <div className={`rank r${index + 1}`}>{index + 1}</div>
      <div className="avatar" style={{ backgroundImage: `url(${mediaUrl(user.photo) || `https://i.pravatar.cc/120?u=${user.id}`})` }} />
      <div>
        <div className="name">{user.display_name}</div>
        <div className="handle">{user.tiktok_handle}</div>
      </div>
    </Reorder.Item>
  );
}

export default function Admin() {
  const { user, ready } = useAuth();
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.categories().then((c) => { setCats(c); setActive(c[0]); }); }, []);
  useEffect(() => {
    if (!active) return;
    api.category(active.slug).then((d) => { setRanking(d.ranking); setDirty(false); });
  }, [active]);

  if (ready && (!user || !user.is_admin)) return <Navigate to="/login" replace />;

  function onReorder(next) { setRanking(next); setDirty(true); setSaved(false); }

  async function save() {
    await api.reorderRanking(active.id, ranking.map((u) => u.id));
    setDirty(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <Nav />
      <div className="shell" style={{ padding: "20px 22px 80px" }}>
        <div className="section-head" style={{ textAlign: "left", marginBottom: 26 }}>
          <h2 style={{ fontSize: 34 }}>Admin <span className="neon-text">dashboard</span></h2>
          <p>Drag rows to reorder the ranking board, then hit save.</p>
        </div>

        <div className="admin-tabs">
          {cats.map((c) => (
            <button key={c.id}
              className={`admin-tab ${active?.id === c.id ? "on" : ""}`}
              onClick={() => setActive(c)}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span>{active?.emoji} {active?.name} · {ranking.length} creators</span>
            <button className="btn" disabled={!dirty} onClick={save}>
              {saved ? "Saved ✓" : dirty ? "Save order" : "No changes"}
            </button>
          </div>
          {ranking.length === 0 ? (
            <p style={{ color: "var(--muted)", padding: 16 }}>No creators in this category yet.</p>
          ) : (
            <Reorder.Group axis="y" values={ranking} onReorder={onReorder} className="admin-list">
              {ranking.map((u, i) => <Item key={u.id} user={u} index={i} />)}
            </Reorder.Group>
          )}
        </div>
      </div>
    </>
  );
}
