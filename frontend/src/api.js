const BASE = import.meta.env.VITE_API_URL || "http://localhost:4137";

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
};
