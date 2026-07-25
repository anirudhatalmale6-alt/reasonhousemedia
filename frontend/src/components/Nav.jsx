import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { BRAND } from "../brand";

export default function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <nav className="nav shell">
      <Link to="/" className="brand"><img src="/logo.png" className="brand-logo" alt="" /> {BRAND.name}</Link>
      <div className="nav-links">
        <Link to="/c/comedy">Categories</Link>
        <Link to="/#leaderboard">Leaderboard</Link>
        {user?.is_admin && <Link to="/admin">Admin</Link>}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {user ? (
          <>
            <Link to={`/u/${user.id}`} className="btn ghost">My profile</Link>
            <button className="btn ghost" onClick={() => { logout(); nav("/"); }}>Log out</button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={() => nav("/login")}>Log in</button>
            <button className="btn" onClick={() => nav("/signup")}>Join the clash</button>
          </>
        )}
      </div>
    </nav>
  );
}
