// ============================================================
// MADDEX AUTH — Replit PostgreSQL + JWT auth + CRUD
// ============================================================

import { ASSET_MAP } from "./maddenAI_resolver";

const TOKEN_KEY = "maddex_token";

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function apiPost(path, body) {
  const res = await fetch(path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiGet(path) {
  const res = await fetch(path, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(path, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiPatch(path, body) {
  const res = await fetch(path, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Delete failed"); }
}

// Listeners for auth state changes
const authListeners = new Set();
function notifyListeners(session) {
  authListeners.forEach(fn => fn(session));
}

// Build a session object from a user record + token
function makeSession(user) {
  return { user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, full_name: user.full_name, avatar_url: user.avatar_url } };
}

// ── Auth ──────────────────────────────────────────────────────

export function onAuthChange(callback) {
  authListeners.add(callback);
  // Return a Supabase-compatible subscription object
  return { unsubscribe: () => authListeners.delete(callback) };
}

export async function getSession() {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await apiGet("/api/auth/me");
    return makeSession(data.user);
  } catch {
    clearToken();
    return null;
  }
}

export async function signIn(email, password) {
  const data = await apiPost("/api/auth/login", { email, password });
  setToken(data.token);
  const session = makeSession(data.user);
  notifyListeners(session);
  return { session };
}

export async function signUp(email, password, firstName, lastName, country = "") {
  const data = await apiPost("/api/auth/signup", { email, password, firstName, lastName, country });
  setToken(data.token);
  const session = makeSession(data.user);
  notifyListeners(session);
  return { session };
}

export async function signOut() {
  clearToken();
  notifyListeners(null);
}

// ── User Profile ──────────────────────────────────────────────

export async function getUserProfile(userId) {
  try {
    const data = await apiGet(`/api/profile/${userId}`);
    return data.profile;
  } catch {
    return null;
  }
}

export async function updateUserProfile(userId, updates) {
  const data = await apiPut(`/api/profile/${userId}`, updates);
  return data.profile;
}

export async function updateEmail(userId, newEmail) {
  return apiPost("/api/auth/update-email", { userId, email: newEmail });
}

export async function updatePassword(userId, newPassword) {
  return apiPost("/api/auth/update-password", { userId, password: newPassword });
}

export async function deleteAccount(userId) {
  await apiDelete(`/api/profile/${userId}`);
  clearToken();
  notifyListeners(null);
}

export async function uploadAvatar(userId, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result;
        const data = await apiPost(`/api/profile/${userId}/avatar`, { base64 });
        resolve(data.avatar_url);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ── Portfolio ──────────────────────────────────────────────────

export async function getPortfolio(userId) {
  try {
    const data = await apiGet(`/api/portfolio/${userId}`);
    return data.items || [];
  } catch { return []; }
}

export async function addToPortfolio(userId, asset, shares) {
  const data = await apiPost(`/api/portfolio/${userId}`, {
    asset_symbol: asset.symbol,
    asset_name:   asset.name,
    asset_type:   asset.type,
    asset_sector: asset.sector || null,
    shares:       parseFloat(shares),
  });
  return data.item;
}

export async function removeFromPortfolio(itemId) {
  await apiDelete(`/api/portfolio/item/${itemId}`);
}

export async function updateShares(itemId, shares) {
  const data = await apiPatch(`/api/portfolio/item/${itemId}`, { shares: parseFloat(shares) });
  return data.item;
}

// ── Watchlist ──────────────────────────────────────────────────

export async function getWatchlist(userId) {
  try {
    const data = await apiGet(`/api/watchlist/${userId}`);
    return data.items || [];
  } catch { return []; }
}

export async function addToWatchlist(userId, asset) {
  const data = await apiPost(`/api/watchlist/${userId}`, {
    asset_symbol: asset.symbol,
    asset_name:   asset.name,
    asset_type:   asset.type,
    asset_sector: asset.sector || null,
  });
  return data.item;
}

export async function removeFromWatchlist(itemId) {
  await apiDelete(`/api/watchlist/item/${itemId}`);
}

// ── Asset Search (unchanged — purely client-side) ──────────────

export function searchAssets(query) {
  if (!query || query.length === 0) return [];
  const q = query.toUpperCase().trim();
  const seen = new Set();
  const results = [];
  for (const [key, asset] of Object.entries(ASSET_MAP)) {
    if (!asset.symbol || seen.has(asset.symbol)) continue;
    const matchesKey  = key.includes(q);
    const matchesName = asset.name?.toUpperCase().includes(q);
    const matchesSym  = asset.symbol?.toUpperCase().replace(".AX", "").includes(q);
    if (matchesKey || matchesName || matchesSym) {
      seen.add(asset.symbol);
      results.push({ ...asset, key });
      if (results.length >= 8) break;
    }
  }
  return results;
}

export async function searchAssetsLive(query) {
  if (!query || query.length < 2) return searchAssets(query);
  const seen = new Set();
  const results = [];
  searchAssets(query).forEach(r => { seen.add(r.symbol); results.push(r); });
  const avKey = import.meta.env.VITE_ALPHA_VANTAGE_KEY || "";
  await Promise.allSettled([
    fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        (data.coins || []).slice(0, 8).forEach(coin => {
          const sym = coin.symbol?.toUpperCase();
          if (!sym || seen.has(sym)) return;
          seen.add(sym);
          results.push({ symbol: sym, name: coin.name, type: "crypto", sector: coin.id, key: sym });
        });
      }),
    avKey && avKey !== "demo"
      ? fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${avKey}`)
          .then(r => r.json())
          .then(data => {
            (data.bestMatches || []).slice(0, 10).forEach(m => {
              const sym = m["1. symbol"];
              const region = (m["4. region"] || "").toLowerCase();
              const kind   = (m["3. type"]   || "Equity").toLowerCase();
              if (!sym || seen.has(sym)) return;
              seen.add(sym);
              let type = "us";
              if (region.includes("australia")) type = "asx";
              else if (kind === "etf")           type = "etf";
              else if (kind === "forex")         type = "fx";
              else if (kind === "cryptocurrency") type = "crypto";
              results.push({ symbol: sym, name: m["2. name"], type, sector: null, key: sym });
            });
          })
      : Promise.resolve(),
  ]);
  return results.slice(0, 20);
}

// ── Portfolio Value Calculation (unchanged) ────────────────────

export const UNLISTED_TYPES = new Set(["cash", "property", "super", "bonds", "business", "other"]);

export function calculatePortfolioValue(portfolio, marketData, extraPrices = {}) {
  return portfolio.map(item => {
    if (UNLISTED_TYPES.has(item.asset_type)) {
      const totalValue = parseFloat(item.shares) || 0;
      return { ...item, livePrice: null, change24h: 0, totalValue, dayChangeAbs: 0 };
    }
    let price = null, change24h = null;
    const sym = (item.asset_symbol || "").toUpperCase();
    if (marketData) {
      if (item.asset_type === "crypto") {
        const found = marketData.crypto?.find(c => c.symbol?.toUpperCase() === sym || c.symbol?.toUpperCase() === sym.replace("/", ""));
        if (found) { price = found.price; change24h = found.change24h; }
      } else if (item.asset_type === "asx") {
        const found = marketData.asx?.find(a => a.symbol?.toUpperCase() === sym || a.symbol?.toUpperCase() === sym + ".AX" || a.symbol?.toUpperCase() === sym.replace(".AX", "") + ".AX");
        if (found) { price = found.price; change24h = found.change24h; }
      } else if (item.asset_type === "us") {
        const found = marketData.us?.find(u => u.symbol?.toUpperCase() === sym);
        if (found) { price = found.price; change24h = found.change24h; }
      }
    }
    if (price == null && extraPrices[sym]) { price = extraPrices[sym].price; change24h = extraPrices[sym].change24h ?? 0; }
    const shares = parseFloat(item.shares) || 0;
    const totalValue = price != null ? price * shares : null;
    const dayChangeAbs = (totalValue != null && change24h != null) ? (totalValue * change24h) / 100 : null;
    return { ...item, livePrice: price, change24h, totalValue, dayChangeAbs };
  });
}

export function getAssetTypeLabel(type) {
  const labels = { asx: "ASX", us: "US", crypto: "Crypto", fx: "FX", commodity: "Commodity", etf: "ETF", macro: "Macro", cash: "Cash", property: "Property", super: "Super", bonds: "Bonds", business: "Business", other: "Other" };
  return labels[type] || (type ? type.toUpperCase() : "Asset");
}

export function getAssetTypeColor(type) {
  const colors = { asx: "#287BFF", us: "#7B6BF5", crypto: "#F5A623", fx: "#00C389", commodity: "#FF8C42", etf: "#6B7FA3", macro: "#6B7FA3", cash: "#00C389", property: "#FF8C42", super: "#3B82F6", bonds: "#06B6D4", business: "#EC4899", other: "#94A3B8" };
  return colors[type] || "#6B7FA3";
}
