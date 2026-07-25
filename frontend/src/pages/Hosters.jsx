import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

export default function Hosters() {
  const [hosters, setHosters] = useState(null);
  useEffect(() => { api.hosters().then(setHosters).catch(() => setHosters([])); }, []);

  return (
    <>
      <Nav />
      <div className="shell" style={{ padding: "10px 22px 80px" }}>
        <div className="events-head">
          <img src="/logo.png" className="brand-logo" alt="" />
          <div>
            <h1 style={{ fontSize: 38 }}>Top <span className="gold-text">Hosters</span></h1>
            <p style={{ color: "var(--muted)", marginTop: 6 }}>The voices running the debates.</p>
          </div>
        </div>

        {!hosters && <p style={{ color: "var(--muted)" }}>Loading…</p>}
        {hosters && hosters.length === 0 && (
          <div className="board" style={{ marginTop: 20 }}>
            <p style={{ color: "var(--muted)", padding: "14px 12px" }}>
              No hosters yet. <Link to="/signup" className="tag">Sign up as a hoster →</Link>
            </p>
          </div>
        )}

        {hosters && hosters.length > 0 && (
          <div className="board" style={{ marginTop: 20 }}>
            <h3><span>🎙️ Host leaderboard</span><span className="tag">{hosters.length} hosters</span></h3>
            {hosters.map((u, i) => (
              <motion.div className="row" key={u.id} custom={i} initial="hidden" animate="show" variants={fade}>
                <div className={`rank r${i + 1}`}>{i + 1}</div>
                <Link to={`/u/${u.id}`} className="avatar"
                  style={{ backgroundImage: `url(${mediaUrl(u.photo) || `https://i.pravatar.cc/120?u=${u.id}`})` }} />
                <div className="name-wrap">
                  <Link to={`/u/${u.id}`} className="name" style={{ display: "block" }}>{u.display_name}</Link>
                  <a className="handle" href={`https://www.tiktok.com/${u.tiktok_handle}`} target="_blank" rel="noreferrer">
                    {u.tiktok_handle} ↗
                  </a>
                </div>
                <div className="score">{u.events_hosted} {u.events_hosted === 1 ? "event" : "events"}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
