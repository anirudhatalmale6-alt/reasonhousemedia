import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Signup() {
  const nav = useNavigate();
  const { persist } = useAuth();
  const fileRef = useRef();
  const [cats, setCats] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({
    display_name: "", tiktok_handle: "", email: "", password: "", category_id: "", join_as: "debater",
  });

  useEffect(() => { api.categories().then((c) => { setCats(c); setForm((f) => ({ ...f, category_id: c[0]?.id || "" })); }); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function onPhoto(e) {
    const f = e.target.files[0];
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (fileRef.current.files[0]) fd.append("photo", fileRef.current.files[0]);
      const { token, user } = await api.signup(fd);
      persist(token, user);
      nav(`/u/${user.id}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <div className="auth-wrap">
        <motion.form className="auth-card" onSubmit={submit}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="glow" />
          <h1 style={{ fontSize: 30 }}>Join the <span className="neon-text">clash</span></h1>
          <p style={{ color: "var(--muted)", margin: "8px 0 22px" }}>Add your photo, handle & climb the board.</p>

          <div className="photo-upload" onClick={() => fileRef.current.click()}>
            {preview ? <img src={preview} alt="preview" /> : <span>+ Photo</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />

          <label>Join as</label>
          <div className="join-as">
            {[
              { v: "debater", label: "🎤 Debater", sub: "Get ranked" },
              { v: "hoster", label: "🎙️ Hoster", sub: "Run events" },
              { v: "both", label: "⚡ Both", sub: "Do it all" },
            ].map((o) => (
              <button type="button" key={o.v}
                className={`join-opt ${form.join_as === o.v ? "on" : ""}`}
                onClick={() => setForm({ ...form, join_as: o.v })}>
                <b>{o.label}</b><span>{o.sub}</span>
              </button>
            ))}
          </div>

          <label>Display name</label>
          <input value={form.display_name} onChange={set("display_name")} placeholder="Aria Vibe" required />

          <label>TikTok handle</label>
          <input value={form.tiktok_handle} onChange={set("tiktok_handle")} placeholder="@ariavibe" required />

          {form.join_as !== "hoster" && (
            <>
              <label>Debate category</label>
              <select value={form.category_id} onChange={set("category_id")}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </>
          )}

          <label>Email</label>
          <input type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" required />

          <label>Password</label>
          <input type="password" value={form.password} onChange={set("password")} placeholder="••••••••" required minLength={6} />

          {err && <p className="form-err">{err}</p>}
          <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
            {busy ? "Creating…" : "Create my profile →"}
          </button>
          <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 16, fontSize: 14 }}>
            Already in? <Link to="/login" className="tag">Log in</Link>
          </p>
        </motion.form>
      </div>
    </>
  );
}
