import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tiktok_handle TEXT NOT NULL,
  photo TEXT,
  graphic_bar TEXT,
  category_id INTEGER,
  is_admin INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  emoji TEXT DEFAULT '🔥',
  color TEXT DEFAULT '#a855f7',
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rankings (
  category_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  position INTEGER DEFAULT 0,
  PRIMARY KEY (category_id, user_id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// ---- Lightweight migrations (for DBs created before a column existed) ----
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userCols.includes("graphic_bar")) db.exec("ALTER TABLE users ADD COLUMN graphic_bar TEXT");
// role: 'user' | 'subadmin' | 'admin' (admin = super admin / owner)
if (!userCols.includes("role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  db.exec("UPDATE users SET role = 'admin' WHERE is_admin = 1");
  db.exec("UPDATE users SET role = 'user' WHERE role IS NULL");
}

// ---- Seed default categories + admin on first run ----
const catCount = db.prepare("SELECT COUNT(*) n FROM categories").get().n;
if (catCount === 0) {
  const seed = db.prepare(
    "INSERT INTO categories (name, slug, emoji, color, position) VALUES (?,?,?,?,?)"
  );
  [
    ["Comedy", "comedy", "🎤", "#ff2e97"],
    ["Dance", "dance", "💃", "#a855f7"],
    ["Gaming", "gaming", "🎮", "#22e0ff"],
    ["Beauty", "beauty", "💄", "#ff7a1a"],
    ["Food", "food", "🍳", "#b6ff3a"],
    ["Music", "music", "🎵", "#ff2e97"],
  ].forEach((c, i) => seed.run(c[0], c[1], c[2], c[3], i));
}

const adminExists = db.prepare("SELECT id FROM users WHERE is_admin = 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare(
    "INSERT INTO users (email, password, display_name, tiktok_handle, is_admin, role) VALUES (?,?,?,?,1,'admin')"
  ).run("admin@clashtok.app", hash, "Admin", "@clashtok");
}

export default db;
