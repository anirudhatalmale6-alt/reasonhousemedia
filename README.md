# ClashTok — TikTok Debate Ranking Site

A colorful, dark-neon debating platform for the TikTok community. Category-based
ranking boards, public signup with photo + display name, clickable TikTok handles,
and an admin dashboard to drag-and-drop reorder the rankings.

> "ClashTok" is a working title — the brand name, colors, categories and copy are
> all easily swappable.

## ✨ Features

- **Dark-neon UI** — vibrant gradients on a dark canvas, animated aurora background,
  lightweight micro-interactions (Framer Motion). Fully responsive & mobile-first.
- **Category ranking boards** — each debate category has its own live leaderboard.
- **Public signup** — anyone joins with a photo, display name, TikTok handle & category.
- **Profiles** — each profile shows the TikTok handle; clicking it opens the creator's
  TikTok page in a new tab.
- **Admin dashboard** — secure, JWT-protected. Drag rows to reorder any category's
  ranking; changes persist to the database.
- **Secure auth** — email + password, hashed with bcrypt, JWT sessions.

## 🧱 Tech stack

| Layer     | Tech                                            |
|-----------|-------------------------------------------------|
| Frontend  | React 19 + Vite, React Router, Framer Motion    |
| Backend   | Node.js + Express                               |
| Database  | SQLite (better-sqlite3)                          |
| Auth      | JWT + bcrypt                                     |
| Uploads   | Multer (profile photos)                          |

## 🚀 Running locally

### 1. Backend
```bash
cd backend
npm install
npm start           # http://localhost:4137  (set PORT env to change)
```
On first run it seeds 6 default categories and an admin account:
- **Email:** `admin@clashtok.app`
- **Password:** `admin123`  ← change this before going live

### 2. Frontend
```bash
cd frontend
npm install
# point the frontend at the API (defaults to http://localhost:4137)
echo "VITE_API_URL=http://localhost:4137" > .env
npm run dev         # http://localhost:5173
```

## 📁 Structure

```
backend/
  server.js     Express app — auth, categories, rankings, admin, uploads
  db.js         SQLite schema + seed data
frontend/
  src/
    pages/      Landing, Category, Profile, Signup, Login, Admin
    components/  Nav
    api.js      API client
    auth.jsx    Auth context (JWT in localStorage)
```

## 🔌 API overview

| Method | Endpoint                              | Notes                    |
|--------|---------------------------------------|--------------------------|
| POST   | `/api/auth/signup`                    | multipart, photo upload  |
| POST   | `/api/auth/login`                     | returns JWT              |
| GET    | `/api/categories`                     | ordered list             |
| GET    | `/api/categories/:slug`               | category + ranking       |
| GET    | `/api/users/:id`                      | public profile           |
| PUT    | `/api/admin/categories/:id/order`     | reorder ranking (admin)  |
| PUT    | `/api/admin/categories/order`         | reorder categories       |
| POST   | `/api/admin/categories`               | add category (admin)     |
| DELETE | `/api/admin/categories/:id`           | remove category (admin)  |

## 🚢 Deploying (one process serves everything)

In production the backend also serves the built frontend, so it's a single process
on a single port — easy to host anywhere.

### Option A — Docker (recommended)
```bash
JWT_SECRET=your-long-random-secret docker compose up -d --build
```
Serves on port 80. Data (SQLite) and uploaded images persist in named volumes.
Put a reverse proxy (Caddy/Nginx) in front for HTTPS + your domain.

### Option B — Plain VPS (no Docker)
```bash
cd frontend && npm ci && VITE_API_URL="" npm run build
cd ../backend && npm ci --omit=dev
NODE_ENV=production PORT=4137 JWT_SECRET=your-secret node server.js
# keep it alive with pm2:  pm2 start server.js --name clashtok
```
Then point Nginx/Caddy at `localhost:4137` for HTTPS.

## 🔒 Before production
- Change the admin password (`admin@clashtok.app` / `admin123`) and set a strong `JWT_SECRET`.
- Serve behind HTTPS (reverse proxy).

## 👥 Roles
- **Super admin** — full control, including managing the admin team.
- **Sub-admin** — manages categories, creators & rankings, but cannot delete
  categories or manage the admin team.
