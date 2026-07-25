// Dev: talk to the standalone API. Prod: served same-origin, so use relative paths.
// Set VITE_API_URL explicitly (even to "") to override.
const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4137" : "");

export const mediaUrl = (p) => (p ? (p.startsWith("http") ? p : BASE + p) : null);

function token() {
  return localStorage.getItem("clashtok_token");
}

async function request(path, { method = "GET", body, form, auth } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${token()}`;
  let payload;
  if (form) {
    payload = form; // FormData — let browser set content-type
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  categories: () => request("/api/categories"),
  category: (slug) => request(`/api/categories/${slug}`),
  user: (id) => request(`/api/users/${id}`),
  me: () => request("/api/me", { auth: true }),
  signup: (form) => request("/api/auth/signup", { method: "POST", form }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  reorderRanking: (catId, order) =>
    request(`/api/admin/categories/${catId}/order`, { method: "PUT", body: { order }, auth: true }),
  reorderCategories: (order) =>
    request("/api/admin/categories/order", { method: "PUT", body: { order }, auth: true }),
  addCategory: (payload) =>
    request("/api/admin/categories", { method: "POST", body: payload, auth: true }),
  deleteCategory: (id) =>
    request(`/api/admin/categories/${id}`, { method: "DELETE", auth: true }),
  // --- admin: members & per-creator media ---
  allUsers: () => request("/api/admin/users", { auth: true }),
  addMember: (catId, userId) =>
    request(`/api/admin/categories/${catId}/members`, { method: "POST", body: { user_id: userId }, auth: true }),
  removeMember: (catId, userId) =>
    request(`/api/admin/categories/${catId}/members/${userId}`, { method: "DELETE", auth: true }),
  updateUser: (id, form) =>
    request(`/api/admin/users/${id}`, { method: "PATCH", form, auth: true }),
  // --- admin team (super admin only) ---
  team: () => request("/api/admin/team", { auth: true }),
  addTeam: (payload) => request("/api/admin/team", { method: "POST", body: payload, auth: true }),
  setTeamRole: (id, role) => request(`/api/admin/team/${id}/role`, { method: "PATCH", body: { role }, auth: true }),
  removeTeam: (id) => request(`/api/admin/team/${id}`, { method: "DELETE", auth: true }),
  // --- events ---
  events: () => request("/api/events"),
  event: (id) => request(`/api/events/${id}`),
  addEvent: (payload) => request("/api/admin/events", { method: "POST", body: payload, auth: true }),
  updateEvent: (id, payload) => request(`/api/admin/events/${id}`, { method: "PATCH", body: payload, auth: true }),
  deleteEvent: (id) => request(`/api/admin/events/${id}`, { method: "DELETE", auth: true }),
  addMatchup: (eventId, payload) => request(`/api/admin/events/${eventId}/matchups`, { method: "POST", body: payload, auth: true }),
  updateMatchup: (id, payload) => request(`/api/admin/matchups/${id}`, { method: "PATCH", body: payload, auth: true }),
  deleteMatchup: (id) => request(`/api/admin/matchups/${id}`, { method: "DELETE", auth: true }),
  // --- hosters ---
  hosters: () => request("/api/hosters"),
  reorderHosters: (order) => request("/api/admin/hosters/order", { method: "PUT", body: { order }, auth: true }),
  addHoster: (userId) => request("/api/admin/hosters", { method: "POST", body: { user_id: userId }, auth: true }),
  removeHoster: (id) => request(`/api/admin/hosters/${id}`, { method: "DELETE", auth: true }),
};
