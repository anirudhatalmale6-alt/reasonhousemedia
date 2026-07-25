import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

export default function Category() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setData(null); setErr(null);
    api.category(slug).then(setData).catch((e) => setErr(e.message));
  }, [slug]);

  return (
    <>
      <Nav />
      <div className="shell" style={{ padding: "20px 22px 80px" }}>
        {err && <p style={{ color: "var(--muted)" }}>Category not found.</p>}
        {!data && !err && <p style={{ color: "var(--muted)" }}>Loading board…</p>}
        {data && (
          <>
            <div className="cat-hero" style={{ borderColor: data.category.color + "55" }}>
              <div className="glow" style={{ background: `radial-gradient(120% 100% at 20% 0%, ${data.category.color}33, transparent 60%)` }} />
              <span style={{ fontSize: 46 }}>{data.category.emoji}</span>
              <div>
                <h1 style={{ fontSize: 40 }}>{data.category.name}</h1>
                <p style={{ color: "var(--muted)", marginTop: 8 }}>{data.ranking.length} creators battling it out</p>
              </div>
              <Link to="/signup" className="btn" style={{ marginLeft: "auto" }}>Join this board</Link>
            </div>

            <div className="board" style={{ marginTop: 26 }}>
              <h3><span>Ranking</span><span className="tag">Updated live</span></h3>
              {data.ranking.length === 0 && (
                <p style={{ color: "var(--muted)", padding: "14px 12px" }}>
                  No one here yet. <Link to="/signup" className="tag">Be the first →</Link>
                </p>
              )}
              {data.ranking.map((u, i) => (
                <motion.div className="row" key={u.id} custom={i} initial="hidden" animate="show" variants={fade}>
                  <div className={`rank r${i + 1}`}>{i + 1}</div>
                  <Link to={`/u/${u.id}`} className="avatar"
                    style={{ backgroundImage: `url(${mediaUrl(u.photo) || `https://i.pravatar.cc/120?u=${u.id}`})` }} />
                  <div>
                    <Link to={`/u/${u.id}`} className="name" style={{ display: "block" }}>{u.display_name}</Link>
                    <a className="handle" href={`https://www.tiktok.com/${u.tiktok_handle}`} target="_blank" rel="noreferrer">
                      {u.tiktok_handle} ↗
                    </a>
                  </div>
                  <div className="score">#{i + 1}</div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
