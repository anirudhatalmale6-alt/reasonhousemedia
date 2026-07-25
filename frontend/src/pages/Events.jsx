import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, mediaUrl } from "../api";

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
};

function Side({ user, winner, side }) {
  if (!user) return <div className="side" />;
  const isWinner = winner === user.id;
  return (
    <div className={`side ${side} ${isWinner ? "winner" : ""}`}>
      <Link to={`/u/${user.id}`} className="avatar"
        style={{ backgroundImage: `url(${mediaUrl(user.photo) || `https://i.pravatar.cc/120?u=${user.id}`})` }} />
      <div>
        <Link to={`/u/${user.id}`} className="m-name">{user.display_name}</Link>
        <div className="m-handle">{user.tiktok_handle}</div>
        {winner != null && (
          <span className={`result-tag ${isWinner ? "w" : "l"}`}>{isWinner ? "W · WINNER" : "L"}</span>
        )}
      </div>
    </div>
  );
}

function Matchup({ m }) {
  return (
    <motion.div className="matchup" initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}>
      <Side user={m.a} winner={m.winner_id} side="left" />
      <div className="vs">
        {m.title && <span className="m-title">{m.title}</span>}
        VS
        {m.method && <span className="method">{m.method}</span>}
      </div>
      <Side user={m.b} winner={m.winner_id} side="right" />
    </motion.div>
  );
}

function EventBlock({ ev }) {
  return (
    <div className="event-block">
      <div className="event-title-row">
        <h2>{ev.title}</h2>
        <span className={`event-status ${ev.status}`}>{ev.status === "completed" ? "Past" : "Upcoming"}</span>
      </div>
      <div className="event-date">
        {ev.event_date}
        {ev.host && <> · Hosted by <Link to={`/u/${ev.host.id}`} className="gold-text" style={{ fontWeight: 700 }}>🎙️ {ev.host.display_name}</Link></>}
      </div>
      <div style={{ marginTop: 14 }}>
        {ev.matchups.length === 0
          ? <p style={{ color: "var(--muted)" }}>Matchups to be announced.</p>
          : ev.matchups.map((m) => <Matchup key={m.id} m={m} />)}
      </div>
    </div>
  );
}

export default function Events() {
  const [data, setData] = useState(null);
  useEffect(() => { api.events().then(setData).catch(() => setData({ upcoming: [], past: [], lastWinners: [] })); }, []);

  return (
    <>
      <Nav />
      <div className="shell" style={{ padding: "10px 22px 80px" }}>
        <div className="events-head">
          <img src="/logo.png" className="brand-logo" alt="" />
          <div>
            <h1 style={{ fontSize: 38 }}>Debate <span className="gold-text">Events</span></h1>
            <p style={{ color: "var(--muted)", marginTop: 6 }}>Head-to-head clashes. Winner takes the W.</p>
          </div>
        </div>

        {!data && <p style={{ color: "var(--muted)" }}>Loading events…</p>}

        {data?.lastWinners?.length > 0 && (
          <motion.div className="last-winner" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h3>🏆 Winners of the last event{data.lastEvent ? ` · ${data.lastEvent.title}` : ""}</h3>
            <div className="winner-chips">
              {data.lastWinners.map((w) => (
                <Link to={`/u/${w.id}`} className="winner-chip" key={w.id}>
                  <span className="crown">👑</span>
                  <div className="avatar" style={{ backgroundImage: `url(${mediaUrl(w.photo) || `https://i.pravatar.cc/120?u=${w.id}`})` }} />
                  <div>
                    <div className="m-name">{w.display_name}</div>
                    <div className="m-handle">{w.tiktok_handle}</div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {data && (
          <>
            <h2 style={{ fontSize: 20, color: "var(--neon-cyan)", margin: "10px 0 18px" }}>Upcoming</h2>
            {data.upcoming.length === 0
              ? <p style={{ color: "var(--muted)", marginBottom: 30 }}>No upcoming events scheduled yet.</p>
              : data.upcoming.map((ev) => <EventBlock key={ev.id} ev={ev} />)}

            <h2 style={{ fontSize: 20, color: "var(--gold)", margin: "26px 0 18px" }}>Past events</h2>
            {data.past.length === 0
              ? <p style={{ color: "var(--muted)" }}>No past events yet.</p>
              : data.past.map((ev) => <EventBlock key={ev.id} ev={ev} />)}
          </>
        )}
      </div>
    </>
  );
}
