import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
// In production VITE_API_BASE_URL should be "/api" — Vercel proxies /api/* to the backend

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
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
