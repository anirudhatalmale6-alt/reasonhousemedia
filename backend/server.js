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
    { id: user.id, email: user.email, is_admin: !!user.is_admin },
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

const publicUser = (u) => ({
  id: u.id,
  display_name: u.display_name,
  tiktok_handle: u.tiktok_handle,
  photo: u.photo,
  category_id: u.category_id,
});

// ================= AUTH =================
app.post("/api/auth/signup", upload.single("photo"), (req, res) => {
  const { email, password, display_name, tiktok_handle, category_id } = req.body;
  if (!email || !password || !display_name || !tiktok_handle)
    return res.status(400).json({ error: "Missing required fields" });

  const handle = tiktok_handle.startsWith("@") ? tiktok_handle : "@" + tiktok_handle;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        "INSERT INTO users (email, password, display_name, tiktok_handle, photo, category_id) VALUES (?,?,?,?,?,?)"
      )
      .run(email.toLowerCase(), hash, display_name, handle, photo, category_id || null);

    // append to that category's ranking board (bottom)
    if (category_id) {
      const max = db
        .prepare("SELECT COALESCE(MAX(position), -1) m FROM rankings WHERE category_id = ?")
        .get(category_id).m;
      db.prepare("INSERT INTO rankings (category_id, user_id, position) VALUES (?,?,?)").run(
        category_id,
        info.lastInsertRowid,
        max + 1
      );
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
  res.json({ token: sign(user), user: { ...publicUser(user), is_admin: !!user.is_admin } });
});

app.get("/api/me", auth(), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ ...publicUser(user), is_admin: !!user.is_admin });
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
      `SELECT u.id, u.display_name, u.tiktok_handle, u.photo, r.position
       FROM rankings r JOIN users u ON u.id = r.user_id
       WHERE r.category_id = ? ORDER BY r.position ASC`
    )
    .all(cat.id);
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
  res.json({ ...publicUser(u), categories: cats });
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

app.delete("/api/admin/categories/:id", auth(), adminOnly, (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`ClashTok API on :${PORT}`));
