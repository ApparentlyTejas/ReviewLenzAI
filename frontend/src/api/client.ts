import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
// In production VITE_API_BASE_URL should be "/api" — Vercel proxies /api/* to the backend

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const ACTIVE_ORG_STORAGE_KEY = "activeOrgId";

export function getActiveOrgId(): number | null {
  const stored = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  return stored ? Number(stored) : null;
}

export function setActiveOrgId(orgId: number | null): void {
  if (orgId === null) localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
  else localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, String(orgId));
}

apiClient.interceptors.request.use((config) => {
  // No header at all (rather than an empty one) means "use my default org" —
  // the backend falls back to the user's earliest membership in that case.
  const orgId = getActiveOrgId();
  if (orgId !== null) config.headers["X-Org-Id"] = orgId;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const wasAuthenticated = !!sessionStorage.getItem("auth_active");
      sessionStorage.removeItem("auth_active");
      if (wasAuthenticated) sessionStorage.setItem("session_expired", "1");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
