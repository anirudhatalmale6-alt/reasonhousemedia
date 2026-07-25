import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const { persist } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const { token, user } = await api.login(email, password);
      persist(token, user);
      nav(user.is_admin ? "/admin" : `/u/${user.id}`);
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
          <h1 style={{ fontSize: 30 }}>Welcome <span className="neon-text">back</span></h1>
          <p style={{ color: "var(--muted)", margin: "8px 0 22px" }}>Log in to manage your profile.</p>

          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />

          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />

          {err && <p className="form-err">{err}</p>}
          <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
            {busy ? "Logging in…" : "Log in →"}
          </button>
          <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 16, fontSize: 14 }}>
            New here? <Link to="/signup" className="tag">Create a profile</Link>
          </p>
        </motion.form>
      </div>
    </>
  );
}
