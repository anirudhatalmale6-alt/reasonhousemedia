import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";

export default function Profile() {
  const { id } = useParams();
  const [u, setU] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setU(null); setErr(null);
    api.user(id).then(setU).catch((e) => setErr(e.message));
  }, [id]);

  return (
    <>
      <Nav />
      <div className="shell" style={{ padding: "20px 22px 80px", maxWidth: 720 }}>
        {err && <p style={{ color: "var(--muted)" }}>Profile not found.</p>}
        {!u && !err && <p style={{ color: "var(--muted)" }}>Loading…</p>}
        {u && (
          <motion.div className="profile-card"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="glow" />
            <div className="profile-avatar"
              style={{ backgroundImage: `url(${mediaUrl(u.photo) || `https://i.pravatar.cc/240?u=${u.id}`})` }} />
            <h1 style={{ fontSize: 34, marginTop: 18 }}>{u.display_name}</h1>
            <a className="tiktok-link" href={`https://www.tiktok.com/${u.tiktok_handle}`} target="_blank" rel="noreferrer">
              <span>🎵</span> {u.tiktok_handle} <span>↗</span>
            </a>
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Tap the handle to open their TikTok in a new tab</p>

            {u.categories?.length > 0 && (
              <div className="profile-ranks">
                <h3 style={{ fontSize: 15, color: "var(--muted)", marginBottom: 14 }}>Ranked in</h3>
                {u.categories.map((c) => (
                  <Link to={`/c/${c.slug}`} className="rank-chip" key={c.slug}>
                    <span>{c.emoji} {c.name}</span>
                    <b className="neon-text">#{c.rank}</b>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </>
  );
}
