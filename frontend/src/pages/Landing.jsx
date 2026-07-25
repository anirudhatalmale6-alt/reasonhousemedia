import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";
import { BRAND } from "../brand";

const FALLBACK_CATS = [
  { name: "Comedy", slug: "comedy", emoji: "🎤", color: "#ff2e97" },
  { name: "Dance", slug: "dance", emoji: "💃", color: "#a855f7" },
  { name: "Gaming", slug: "gaming", emoji: "🎮", color: "#22e0ff" },
  { name: "Beauty", slug: "beauty", emoji: "💄", color: "#ff7a1a" },
  { name: "Food", slug: "food", emoji: "🍳", color: "#b6ff3a" },
  { name: "Music", slug: "music", emoji: "🎵", color: "#ff2e97" },
];

const TAGS = {
  comedy: "Who's the funniest?", dance: "Best moves on the FYP", gaming: "Top clip creators",
  beauty: "GRWM royalty", food: "Recipe legends", music: "Rising sounds",
};

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Landing() {
  const [cats, setCats] = useState(FALLBACK_CATS);
  const [board, setBoard] = useState(null);

  useEffect(() => {
    api.categories().then((c) => c.length && setCats(c)).catch(() => {});
    api.category("comedy").then(setBoard).catch(() => {});
  }, []);

  const leaders = board?.ranking?.slice(0, 5) || [];

  return (
    <>
      <Nav />

      <header className="hero shell">
        <motion.div initial="hidden" animate="show" variants={fade}>
          <span className="pill"><span className="live" /> Live rankings · community powered</span>
          <h1>Settle the debate.<br /><span className="neon-text">Rank the TikTok GOATs.</span></h1>
          <p className="sub">
            The colorful arena where the community decides who's really on top.
            Add your photo, drop your TikTok handle, and climb the neon leaderboard.
          </p>
          <div className="hero-cta">
            <Link to="/signup" className="btn">Create your profile →</Link>
            <Link to={`/c/${cats[0]?.slug || "comedy"}`} className="btn ghost">Browse rankings</Link>
          </div>
          <div className="stats">
            <div className="stat"><b className="neon-text">{board?.ranking?.length || 0}+</b><span>Creators ranked</span></div>
            <div className="stat"><b className="neon-text">{cats.length}</b><span>Debate categories</span></div>
            <div className="stat"><b className="neon-text">98%</b><span>Mobile players</span></div>
          </div>
        </motion.div>

        <motion.div className="board" id="leaderboard"
          initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}>
          <h3><span>🔥 {board?.category?.name || "Comedy"} · Top ranked</span>
            <Link className="tag" to={`/c/${board?.category?.slug || "comedy"}`}>View all →</Link></h3>
          {leaders.length === 0 && <p style={{ color: "var(--muted)", padding: "10px 12px" }}>Be the first to join this board →</p>}
          {leaders.map((u, i) => (
            <motion.div className="row" key={u.id} custom={i} initial="hidden" animate="show" variants={fade}>
              <div className={`rank r${i + 1}`}>{i + 1}</div>
              <Link to={`/u/${u.id}`} className="avatar"
                style={{ backgroundImage: `url(${mediaUrl(u.photo) || `https://i.pravatar.cc/120?u=${u.id}`})` }} />
              <div>
                <Link to={`/u/${u.id}`} className="name" style={{ display: "block" }}>{u.display_name}</Link>
                <a className="handle" href={`https://www.tiktok.com/${u.tiktok_handle}`} target="_blank" rel="noreferrer">{u.tiktok_handle} ↗</a>
              </div>
              <div className="score">#{i + 1}</div>
            </motion.div>
          ))}
        </motion.div>
      </header>

      <section className="section shell" id="categories">
        <div className="section-head">
          <h2>Pick your <span className="neon-text">battleground</span></h2>
          <p>Every corner of TikTok gets its own ranked arena.</p>
        </div>
        <div className="cat-grid">
          {cats.map((c, i) => (
            <motion.div key={c.slug} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}>
              <Link to={`/c/${c.slug}`} className="cat" style={{ display: "block" }}>
                <div className="glow" style={{ background: `radial-gradient(120% 90% at 50% 0%, ${c.color}44, transparent 60%)` }} />
                <span className="emoji">{c.emoji}</span>
                <h4>{c.name}</h4>
                <span>{TAGS[c.slug] || "Who's on top?"}</span>
                <span className="arrow">↗</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="footer shell">
        <div className="brand"><span className="dot" /> {BRAND.name}</div>
        <p>The community-powered TikTok debate arena</p>
      </footer>
    </>
  );
}
