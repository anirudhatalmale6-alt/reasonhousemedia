import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "clashtok-dev-secret-change-me";
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

// ---- Uploads ----
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `p_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /image\/(png|jpe?g|webp|gif)/.test(file.mimetype)),
});

// ---- Auth helpers ----
function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_admin: !!user.is_admin, role: user.role || "user" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return required ? res.status(401).json({ error: "No token" }) : next();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
function adminOnly(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: "Admin only" });
  next();
}
// Only the super admin (role 'admin') can manage the admin team
function superOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Super admin only" });
  next();
}

const publicUser = (u) => ({
  id: u.id,
  display_name: u.display_name,
  tiktok_handle: u.tiktok_handle,
  photo: u.photo,
  graphic_bar: u.graphic_bar,
  category_id: u.category_id,
  is_debater: !!u.is_debater,
  is_hoster: !!u.is_hoster,
});

const eventsHostedCount = (userId) =>
  db.prepare("SELECT COUNT(*) n FROM events WHERE host_id = ?").get(userId).n;

// Win/loss record for a creator, plus their most recent result ('W' | 'L' | null)
function recordFor(userId) {
  const wins = db.prepare("SELECT COUNT(*) n FROM matchups WHERE winner_id = ?").get(userId).n;
  const losses = db
    .prepare("SELECT COUNT(*) n FROM matchups WHERE winner_id IS NOT NULL AND winner_id != ? AND (a_user_id = ? OR b_user_id = ?)")
    .get(userId, userId, userId).n;
  const last = db
    .prepare("SELECT winner_id FROM matchups WHERE winner_id IS NOT NULL AND (a_user_id = ? OR b_user_id = ?) ORDER BY id DESC LIMIT 1")
    .get(userId, userId);
  return { wins, losses, last: last ? (last.winner_id === userId ? "W" : "L") : null };
}

// Full matchup with both participants resolved — for event listings
function matchupView(m) {
  const p = (id) => {
    const u = db.prepare("SELECT id, display_name, tiktok_handle, photo FROM users WHERE id = ?").get(id);
    return u || null;
  };
  return {
    id: m.id,
    title: m.title,
    method: m.method,
    a: p(m.a_user_id),
    b: p(m.b_user_id),
    winner_id: m.winner_id,
  };
}

function eventView(e) {
  const matchups = db
    .prepare("SELECT * FROM matchups WHERE event_id = ? ORDER BY position ASC, id ASC")
    .all(e.id)
    .map(matchupView);
  const host = e.host_id
    ? db.prepare("SELECT id, display_name, tiktok_handle, photo FROM users WHERE id = ?").get(e.host_id)
    : null;
  return { ...e, matchups, host };
}

// ================= AUTH =================
app.post("/api/auth/signup", upload.single("photo"), (req, res) => {
  const { email, password, display_name, tiktok_handle, category_id } = req.body;
  if (!email || !password || !display_name || !tiktok_handle)
    return res.status(400).json({ error: "Missing required fields" });

  // join_as: 'debater' | 'hoster' | 'both'  (default debater)
  const joinAs = ["debater", "hoster", "both"].includes(req.body.join_as) ? req.body.join_as : "debater";
  const isDebater = joinAs === "debater" || joinAs === "both" ? 1 : 0;
  const isHoster = joinAs === "hoster" || joinAs === "both" ? 1 : 0;

  const handle = tiktok_handle.startsWith("@") ? tiktok_handle : "@" + tiktok_handle;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        "INSERT INTO users (email, password, display_name, tiktok_handle, photo, category_id, is_debater, is_hoster) VALUES (?,?,?,?,?,?,?,?)"
      )
      .run(email.toLowerCase(), hash, display_name, handle, photo, category_id || null, isDebater, isHoster);

    // debaters: append to their chosen category board
    if (isDebater && category_id) {
      const max = db
        .prepare("SELECT COALESCE(MAX(position), -1) m FROM rankings WHERE category_id = ?")
        .get(category_id).m;
      db.prepare("INSERT INTO rankings (category_id, user_id, position) VALUES (?,?,?)").run(
        category_id,
        info.lastInsertRowid,
        max + 1
      );
    }
    // hosters: append to the Top Hosters board
    if (isHoster) {
      const hmax = db.prepare("SELECT COALESCE(MAX(hoster_position), -1) m FROM users WHERE is_hoster = 1").get().m;
      db.prepare("UPDATE users SET hoster_position = ? WHERE id = ?").run(hmax + 1, info.lastInsertRowid);
    }
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password))
    return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: sign(user), user: { ...publicUser(user), is_admin: !!user.is_admin, role: user.role } });
});

app.get("/api/me", auth(), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ ...publicUser(user), is_admin: !!user.is_admin, role: user.role });
});

// ================= CATEGORIES =================
app.get("/api/categories", (_req, res) => {
  res.json(db.prepare("SELECT * FROM categories ORDER BY position ASC, id ASC").all());
});

app.get("/api/categories/:slug", (req, res) => {
  const cat = db.prepare("SELECT * FROM categories WHERE slug = ?").get(req.params.slug);
  if (!cat) return res.status(404).json({ error: "Category not found" });
  const users = db
    .prepare(
      `SELECT u.id, u.display_name, u.tiktok_handle, u.photo, u.graphic_bar, r.position
       FROM rankings r JOIN users u ON u.id = r.user_id
       WHERE r.category_id = ? ORDER BY r.position ASC`
    )
    .all(cat.id)
    .map((u) => ({ ...u, record: recordFor(u.id) }));
  res.json({ category: cat, ranking: users });
});

// ================= PROFILES =================
app.get("/api/users/:id", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "Not found" });
  const cats = db
    .prepare(
      `SELECT c.name, c.slug, c.emoji, r.position + 1 AS rank
       FROM rankings r JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ? ORDER BY r.position ASC`
    )
    .all(u.id);
  // this creator's fight history (decided matchups they were in)
  const history = db
    .prepare(
      `SELECT m.id, m.title, m.method, m.winner_id, e.title AS event_title, e.event_date, e.status,
              m.a_user_id, m.b_user_id
       FROM matchups m JOIN events e ON e.id = m.event_id
       WHERE m.a_user_id = ? OR m.b_user_id = ?
       ORDER BY m.id DESC`
    )
    .all(u.id, u.id)
    .map((m) => {
      const oppId = m.a_user_id === u.id ? m.b_user_id : m.a_user_id;
      const opp = db.prepare("SELECT id, display_name, tiktok_handle FROM users WHERE id = ?").get(oppId);
      return {
        event_title: m.event_title, event_date: m.event_date, status: m.status,
        method: m.method, opponent: opp,
        result: m.winner_id ? (m.winner_id === u.id ? "W" : "L") : null,
      };
    });
  res.json({ ...publicUser(u), categories: cats, record: recordFor(u.id), history, events_hosted: eventsHostedCount(u.id) });
});

// ================= ADMIN =================
// Reorder a category's ranking board. Body: { order: [userId, userId, ...] }
app.put("/api/admin/categories/:id/order", auth(), adminOnly, (req, res) => {
  const catId = Number(req.params.id);
  const order = req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });
  const stmt = db.prepare("UPDATE rankings SET position = ? WHERE category_id = ? AND user_id = ?");
  const tx = db.transaction((ids) => ids.forEach((uid, i) => stmt.run(i, catId, uid)));
  tx(order);
  res.json({ ok: true });
});

// Reorder categories themselves. Body: { order: [catId, ...] }
app.put("/api/admin/categories/order", auth(), adminOnly, (req, res) => {
  const order = req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });
  const stmt = db.prepare("UPDATE categories SET position = ? WHERE id = ?");
  const tx = db.transaction((ids) => ids.forEach((cid, i) => stmt.run(i, cid)));
  tx(order);
  res.json({ ok: true });
});

app.post("/api/admin/categories", auth(), adminOnly, (req, res) => {
  const { name, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const max = db.prepare("SELECT COALESCE(MAX(position), -1) m FROM categories").get().m;
  try {
    const info = db
      .prepare("INSERT INTO categories (name, slug, emoji, color, position) VALUES (?,?,?,?,?)")
      .run(name, slug, emoji || "🔥", color || "#a855f7", max + 1);
    res.json(db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid));
  } catch {
    res.status(409).json({ error: "Category already exists" });
  }
});

// Deleting a category is destructive — super admins only
app.delete("/api/admin/categories/:id", auth(), superOnly, (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---- List every creator (admin) — for assigning into categories ----
app.get("/api/admin/users", auth(), adminOnly, (_req, res) => {
  const users = db
    .prepare("SELECT id, display_name, tiktok_handle, photo, graphic_bar, is_debater, is_hoster FROM users WHERE is_admin = 0 ORDER BY display_name COLLATE NOCASE")
    .all();
  res.json(users);
});

// ---- Add an existing creator to a category's board (bottom) ----
app.post("/api/admin/categories/:id/members", auth(), adminOnly, (req, res) => {
  const catId = Number(req.params.id);
  const userId = Number(req.body.user_id);
  if (!userId) return res.status(400).json({ error: "user_id required" });
  const exists = db.prepare("SELECT 1 FROM rankings WHERE category_id = ? AND user_id = ?").get(catId, userId);
  if (exists) return res.status(409).json({ error: "Creator already in this category" });
  const max = db.prepare("SELECT COALESCE(MAX(position), -1) m FROM rankings WHERE category_id = ?").get(catId).m;
  db.prepare("INSERT INTO rankings (category_id, user_id, position) VALUES (?,?,?)").run(catId, userId, max + 1);
  res.json({ ok: true });
});

// ---- Remove a creator from a category's board ----
app.delete("/api/admin/categories/:id/members/:userId", auth(), adminOnly, (req, res) => {
  db.prepare("DELETE FROM rankings WHERE category_id = ? AND user_id = ?").run(req.params.id, req.params.userId);
  res.json({ ok: true });
});

// ---- Update a creator: profile pic, custom graphic bar, name/handle (admin) ----
app.patch(
  "/api/admin/users/:id",
  auth(),
  adminOnly,
  upload.fields([{ name: "photo", maxCount: 1 }, { name: "graphic_bar", maxCount: 1 }]),
  (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "Creator not found" });

    const fields = [];
    const vals = [];
    if (req.body.display_name) { fields.push("display_name = ?"); vals.push(req.body.display_name); }
    if (req.body.tiktok_handle) {
      const h = req.body.tiktok_handle.startsWith("@") ? req.body.tiktok_handle : "@" + req.body.tiktok_handle;
      fields.push("tiktok_handle = ?"); vals.push(h);
    }
    if (req.files?.photo?.[0]) { fields.push("photo = ?"); vals.push(`/uploads/${req.files.photo[0].filename}`); }
    if (req.files?.graphic_bar?.[0]) { fields.push("graphic_bar = ?"); vals.push(`/uploads/${req.files.graphic_bar[0].filename}`); }

    if (fields.length) {
      db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...vals, req.params.id);
    }
    res.json(publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id)));
  }
);

// ================= ADMIN TEAM (super admin only) =================
const teamUser = (u) => ({
  id: u.id, email: u.email, display_name: u.display_name, role: u.role, created_at: u.created_at,
});

// List all admins + sub-admins
app.get("/api/admin/team", auth(), superOnly, (_req, res) => {
  const team = db
    .prepare("SELECT id, email, display_name, role, created_at FROM users WHERE role IN ('admin','subadmin') ORDER BY role DESC, id ASC")
    .all();
  res.json(team);
});

// Create a new admin or sub-admin
app.post("/api/admin/team", auth(), superOnly, (req, res) => {
  const { email, password, display_name, role } = req.body;
  if (!email || !password || !display_name) return res.status(400).json({ error: "Missing required fields" });
  if (!["admin", "subadmin"].includes(role)) return res.status(400).json({ error: "role must be admin or subadmin" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (email, password, display_name, tiktok_handle, is_admin, role) VALUES (?,?,?,?,1,?)")
      .run(email.toLowerCase(), hash, display_name, "@" + email.split("@")[0], role);
    res.json(teamUser(db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid)));
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Could not create admin" });
  }
});

// Change a team member's role (promote/demote)
app.patch("/api/admin/team/:id/role", auth(), superOnly, (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  if (!["admin", "subadmin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (id === req.user.id) return res.status(400).json({ error: "You can't change your own role" });
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!target || target.role === "user") return res.status(404).json({ error: "Team member not found" });
  db.prepare("UPDATE users SET role = ?, is_admin = 1 WHERE id = ?").run(role, id);
  res.json(teamUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id)));
});

// Remove a team member's admin access (revoke back to normal user)
app.delete("/api/admin/team/:id", auth(), superOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "You can't remove yourself" });
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!target || target.role === "user") return res.status(404).json({ error: "Team member not found" });
  // never allow removing the last super admin
  if (target.role === "admin") {
    const supers = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin'").get().n;
    if (supers <= 1) return res.status(400).json({ error: "Can't remove the last super admin" });
  }
  db.prepare("UPDATE users SET role = 'user', is_admin = 0 WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ================= EVENTS (public) =================
app.get("/api/events", (_req, res) => {
  const events = db.prepare("SELECT * FROM events ORDER BY position ASC, id DESC").all().map(eventView);
  const upcoming = events.filter((e) => e.status !== "completed");
  const past = events.filter((e) => e.status === "completed");
  // headline winners from the most recent completed event
  const lastEvent = past[0] || null;
  const lastWinners = lastEvent
    ? lastEvent.matchups.filter((m) => m.winner_id).map((m) => (m.winner_id === m.a?.id ? m.a : m.b))
    : [];
  res.json({ upcoming, past, lastEvent, lastWinners });
});

app.get("/api/events/:id", (req, res) => {
  const e = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Event not found" });
  res.json(eventView(e));
});

// ================= EVENTS (admin) =================
app.post("/api/admin/events", auth(), adminOnly, (req, res) => {
  const { title, event_date, host_id } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const max = db.prepare("SELECT COALESCE(MAX(position), -1) m FROM events").get().m;
  const info = db
    .prepare("INSERT INTO events (title, event_date, host_id, status, position) VALUES (?,?,?,'upcoming',?)")
    .run(title, event_date || null, host_id || null, max + 1);
  res.json(eventView(db.prepare("SELECT * FROM events WHERE id = ?").get(info.lastInsertRowid)));
});

app.patch("/api/admin/events/:id", auth(), adminOnly, (req, res) => {
  const e = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Event not found" });
  const { title, event_date, status, host_id } = req.body;
  const fields = [], vals = [];
  if (title !== undefined) { fields.push("title = ?"); vals.push(title); }
  if (event_date !== undefined) { fields.push("event_date = ?"); vals.push(event_date); }
  if (status !== undefined && ["upcoming", "completed"].includes(status)) { fields.push("status = ?"); vals.push(status); }
  if (host_id !== undefined) { fields.push("host_id = ?"); vals.push(host_id || null); }
  if (fields.length) db.prepare(`UPDATE events SET ${fields.join(", ")} WHERE id = ?`).run(...vals, req.params.id);
  res.json(eventView(db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id)));
});

app.delete("/api/admin/events/:id", auth(), superOnly, (req, res) => {
  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Add a matchup (two creators) to an event
app.post("/api/admin/events/:id/matchups", auth(), adminOnly, (req, res) => {
  const eventId = Number(req.params.id);
  const { a_user_id, b_user_id, title, method } = req.body;
  if (!a_user_id || !b_user_id) return res.status(400).json({ error: "Both creators are required" });
  if (Number(a_user_id) === Number(b_user_id)) return res.status(400).json({ error: "Pick two different creators" });
  const max = db.prepare("SELECT COALESCE(MAX(position), -1) m FROM matchups WHERE event_id = ?").get(eventId).m;
  const info = db
    .prepare("INSERT INTO matchups (event_id, a_user_id, b_user_id, title, method, position) VALUES (?,?,?,?,?,?)")
    .run(eventId, a_user_id, b_user_id, title || null, method || null, max + 1);
  res.json(matchupView(db.prepare("SELECT * FROM matchups WHERE id = ?").get(info.lastInsertRowid)));
});

// Set the winner (or clear it) / update method of a matchup
app.patch("/api/admin/matchups/:id", auth(), adminOnly, (req, res) => {
  const m = db.prepare("SELECT * FROM matchups WHERE id = ?").get(req.params.id);
  if (!m) return res.status(404).json({ error: "Matchup not found" });
  const { winner_id, method, title } = req.body;
  const fields = [], vals = [];
  if (winner_id !== undefined) {
    if (winner_id !== null && ![m.a_user_id, m.b_user_id].includes(Number(winner_id)))
      return res.status(400).json({ error: "Winner must be one of the two creators" });
    fields.push("winner_id = ?"); vals.push(winner_id === null ? null : Number(winner_id));
  }
  if (method !== undefined) { fields.push("method = ?"); vals.push(method); }
  if (title !== undefined) { fields.push("title = ?"); vals.push(title); }
  if (fields.length) db.prepare(`UPDATE matchups SET ${fields.join(", ")} WHERE id = ?`).run(...vals, req.params.id);
  res.json(matchupView(db.prepare("SELECT * FROM matchups WHERE id = ?").get(req.params.id)));
});

app.delete("/api/admin/matchups/:id", auth(), superOnly, (req, res) => {
  db.prepare("DELETE FROM matchups WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ================= HOSTERS =================
// Public "Top Hosters" board
app.get("/api/hosters", (_req, res) => {
  const hosters = db
    .prepare("SELECT id, display_name, tiktok_handle, photo, graphic_bar FROM users WHERE is_hoster = 1 ORDER BY hoster_position ASC, id ASC")
    .all()
    .map((u) => ({ ...u, events_hosted: eventsHostedCount(u.id) }));
  res.json(hosters);
});

// Admin: reorder the hosters board
app.put("/api/admin/hosters/order", auth(), adminOnly, (req, res) => {
  const order = req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });
  const stmt = db.prepare("UPDATE users SET hoster_position = ? WHERE id = ? AND is_hoster = 1");
  const tx = db.transaction((ids) => ids.forEach((uid, i) => stmt.run(i, uid)));
  tx(order);
  res.json({ ok: true });
});

// Admin: make an existing creator a hoster
app.post("/api/admin/hosters", auth(), adminOnly, (req, res) => {
  const userId = Number(req.body.user_id);
  if (!userId) return res.status(400).json({ error: "user_id required" });
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!u) return res.status(404).json({ error: "User not found" });
  if (u.is_hoster) return res.status(409).json({ error: "Already a hoster" });
  const hmax = db.prepare("SELECT COALESCE(MAX(hoster_position), -1) m FROM users WHERE is_hoster = 1").get().m;
  db.prepare("UPDATE users SET is_hoster = 1, hoster_position = ? WHERE id = ?").run(hmax + 1, userId);
  res.json({ ok: true });
});

// Admin: remove hoster status
app.delete("/api/admin/hosters/:id", auth(), adminOnly, (req, res) => {
  db.prepare("UPDATE users SET is_hoster = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---- Serve the built frontend in production (single deployable process) ----
const distDir = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback — let API & uploads pass through, everything else gets index.html
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
  console.log("Serving frontend from", distDir);
}

app.listen(PORT, () => console.log(`ClashTok running on :${PORT}`));
