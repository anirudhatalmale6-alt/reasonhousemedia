import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Reorder, useDragControls, AnimatePresence, motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";

const EMOJIS = ["🔥", "🎤", "💃", "🎮", "💄", "🍳", "🎵", "⚽", "🎬", "🐶", "✈️", "🎨"];
const COLORS = ["#ff2e97", "#a855f7", "#22e0ff", "#ff7a1a", "#b6ff3a", "#22ffa5"];

function Handle({ controls }) {
  return <span className="drag-handle" onPointerDown={(e) => controls.start(e)} title="Drag to reorder">⠿</span>;
}

function Item({ user, index, onEdit, onRemove }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={user} dragListener={false} dragControls={controls} className="admin-row">
      <Handle controls={controls} />
      <div className={`rank r${index + 1}`}>{index + 1}</div>
      <div className="avatar" style={{ backgroundImage: `url(${mediaUrl(user.photo) || `https://i.pravatar.cc/120?u=${user.id}`})` }} />
      <div className="admin-row-main">
        {user.graphic_bar && <div className="graphic-bar" style={{ backgroundImage: `url(${mediaUrl(user.graphic_bar)})` }} />}
        <div className="name">{user.display_name}</div>
        <div className="handle">{user.tiktok_handle}</div>
      </div>
      <div className="admin-row-actions">
        <button className="mini-btn" onClick={() => onEdit(user)}>Edit</button>
        <button className="mini-btn danger" onClick={() => onRemove(user)}>Remove</button>
      </div>
    </Reorder.Item>
  );
}

/* ---------- Per-creator editor modal ---------- */
function EditModal({ user, onClose, onSaved }) {
  const photoRef = useRef();
  const barRef = useRef();
  const [photoPrev, setPhotoPrev] = useState(mediaUrl(user.photo));
  const [barPrev, setBarPrev] = useState(mediaUrl(user.graphic_bar));
  const [name, setName] = useState(user.display_name);
  const [handle, setHandle] = useState(user.tiktok_handle);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const fd = new FormData();
    fd.append("display_name", name);
    fd.append("tiktok_handle", handle);
    if (photoRef.current.files[0]) fd.append("photo", photoRef.current.files[0]);
    if (barRef.current.files[0]) fd.append("graphic_bar", barRef.current.files[0]);
    const updated = await api.updateUser(user.id, fd);
    setBusy(false);
    onSaved(updated);
  }

  return (
    <motion.div className="modal-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}>
        <div className="glow" />
        <h3 style={{ fontSize: 22, marginBottom: 4 }}>Edit <span className="neon-text">{user.display_name}</span></h3>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>Change the photo, upload a custom graphic bar, or tweak the details.</p>

        <label>Profile picture</label>
        <div className="edit-photo-row">
          <div className="edit-photo" style={{ backgroundImage: photoPrev ? `url(${photoPrev})` : "none" }} onClick={() => photoRef.current.click()}>
            {!photoPrev && <span>+ Pic</span>}
          </div>
          <button className="mini-btn" onClick={() => photoRef.current.click()}>Change pic</button>
          <input ref={photoRef} type="file" accept="image/*" hidden
            onChange={(e) => e.target.files[0] && setPhotoPrev(URL.createObjectURL(e.target.files[0]))} />
        </div>

        <label style={{ marginTop: 16 }}>Custom graphic bar</label>
        <div className="edit-bar" style={{ backgroundImage: barPrev ? `url(${barPrev})` : "none" }} onClick={() => barRef.current.click()}>
          {!barPrev && <span>+ Upload graphic bar</span>}
        </div>
        <input ref={barRef} type="file" accept="image/*" hidden
          onChange={(e) => e.target.files[0] && setBarPrev(URL.createObjectURL(e.target.files[0]))} />

        <label style={{ marginTop: 16 }}>Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label style={{ marginTop: 12 }}>TikTok handle</label>
        <input value={handle} onChange={(e) => setHandle(e.target.value)} />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 1 }} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Admin() {
  const { user, ready } = useAuth();
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", emoji: "🔥", color: "#a855f7" });
  const [addUserId, setAddUserId] = useState("");

  const loadCats = () => api.categories().then((c) => { setCats(c); setActive((a) => c.find((x) => x.id === a?.id) || c[0] || null); });
  const loadBoard = (a) => a && api.category(a.slug).then((d) => { setRanking(d.ranking); setDirty(false); });

  useEffect(() => { loadCats(); api.allUsers().then(setAllUsers).catch(() => {}); }, []);
  useEffect(() => { loadBoard(active); }, [active]);

  if (ready && (!user || !user.is_admin)) return <Navigate to="/login" replace />;

  function onReorder(next) { setRanking(next); setDirty(true); setSaved(false); }
  async function saveOrder() {
    await api.reorderRanking(active.id, ranking.map((u) => u.id));
    setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  async function addCategory() {
    if (!newCat.name.trim()) return;
    await api.addCategory(newCat);
    setNewCat({ name: "", emoji: "🔥", color: "#a855f7" }); setShowAddCat(false);
    await loadCats();
  }
  async function deleteCategory(cat) {
    if (!confirm(`Delete category "${cat.name}"? This removes its ranking board.`)) return;
    await api.deleteCategory(cat.id);
    await loadCats();
  }
  async function addMember() {
    if (!addUserId) return;
    await api.addMember(active.id, Number(addUserId));
    setAddUserId(""); loadBoard(active);
  }
  async function removeMember(u) {
    await api.removeMember(active.id, u.id);
    setRanking((r) => r.filter((x) => x.id !== u.id));
  }
  function onCreatorSaved(updated) {
    setRanking((r) => r.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    setAllUsers((r) => r.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
    setEditing(null);
  }

  const notInCategory = allUsers.filter((u) => !ranking.some((r) => r.id === u.id));

  return (
    <>
      <Nav />
      <div className="shell" style={{ padding: "20px 22px 80px" }}>
        <div className="section-head" style={{ textAlign: "left", marginBottom: 22 }}>
          <h2 style={{ fontSize: 34 }}>Admin <span className="neon-text">dashboard</span></h2>
          <p>Add categories, assign creators, drag to reorder, and give each creator a custom pic &amp; graphic bar.</p>
        </div>

        {/* Category tabs + add */}
        <div className="admin-tabs">
          {cats.map((c) => (
            <div key={c.id} className={`admin-tab-wrap ${active?.id === c.id ? "on" : ""}`}>
              <button className="admin-tab-btn" onClick={() => setActive(c)}>{c.emoji} {c.name}</button>
              <button className="admin-tab-x" title="Delete category" onClick={() => deleteCategory(c)}>×</button>
            </div>
          ))}
          <button className="admin-tab-add" onClick={() => setShowAddCat((v) => !v)}>＋ Add category</button>
        </div>

        <AnimatePresence>
          {showAddCat && (
            <motion.div className="add-cat" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <input placeholder="Category name (e.g. Vlogs)" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <div className="picker">
                {EMOJIS.map((e) => <button key={e} className={`emoji-pick ${newCat.emoji === e ? "on" : ""}`} onClick={() => setNewCat({ ...newCat, emoji: e })}>{e}</button>)}
              </div>
              <div className="picker">
                {COLORS.map((c) => <button key={c} className={`color-pick ${newCat.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setNewCat({ ...newCat, color: c })} />)}
              </div>
              <button className="btn" onClick={addCategory}>Create category</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active category panel */}
        {active && (
          <div className="admin-panel">
            <div className="admin-panel-head">
              <span>{active.emoji} {active.name} · {ranking.length} creators</span>
              <button className="btn" disabled={!dirty} onClick={saveOrder}>
                {saved ? "Saved ✓" : dirty ? "Save order" : "No changes"}
              </button>
            </div>

            {/* Assign creator */}
            <div className="assign-row">
              <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                <option value="">＋ Insert a creator into this category…</option>
                {notInCategory.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({u.tiktok_handle})</option>)}
              </select>
              <button className="btn ghost" onClick={addMember} disabled={!addUserId}>Add</button>
            </div>

            {ranking.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: 16 }}>No creators in this category yet — assign one above.</p>
            ) : (
              <Reorder.Group axis="y" values={ranking} onReorder={onReorder} className="admin-list">
                {ranking.map((u, i) => <Item key={u.id} user={u} index={i} onEdit={setEditing} onRemove={removeMember} />)}
              </Reorder.Group>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && <EditModal user={editing} onClose={() => setEditing(null)} onSaved={onCreatorSaved} />}
      </AnimatePresence>
    </>
  );
}
