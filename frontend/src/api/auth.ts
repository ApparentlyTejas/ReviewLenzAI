import { apiClient } from "./client";
import type { User } from "../types";

export async function registerUser(email: string, password: string): Promise<void> {
  await apiClient.post("/auth/register", { email, password });
}

export async function verifyEmail(token: string): Promise<void> {
  await apiClient.get(`/auth/verify?token=${encodeURIComponent(token)}`);
}

export async function resendVerification(email: string): Promise<void> {
  await apiClient.post("/auth/resend-verification", { email });
}

export async function loginUser(email: string, password: string): Promise<void> {
  await apiClient.post("/auth/login", { email, password });
}

export async function logoutUser(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function loginWithGoogle(accessToken: string): Promise<void> {
  await apiClient.post("/auth/google", { access_token: accessToken });
}

export async function loginWithGitHub(code: string): Promise<void> {
  await apiClient.post("/auth/github", { code });
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/password", { current_password: currentPassword, new_password: newPassword });
}

export async function disconnectGitHub(): Promise<void> {
  await apiClient.post("/auth/github/disconnect");
}

export async function deleteAccount(currentPassword?: string): Promise<void> {
  await apiClient.delete("/auth/account", { data: { current_password: currentPassword } });
}

export async function updateUsername(username: string): Promise<User> {
  const { data } = await apiClient.post<User>("/auth/username", { username });
  return data;
}
