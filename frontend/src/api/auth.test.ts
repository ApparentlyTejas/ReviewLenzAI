import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from "./client";
import {
  getCurrentUser,
  loginUser,
  loginWithGitHub,
  loginWithGoogle,
  logoutUser,
  registerUser,
  resendVerification,
  verifyEmail,
} from "./auth";

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth api", () => {
  it("registerUser posts email and password", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await registerUser("a@b.com", "secret");
    expect(mockedPost).toHaveBeenCalledWith("/auth/register", { email: "a@b.com", password: "secret" });
  });

  it("verifyEmail GETs with an encoded token", async () => {
    mockedGet.mockResolvedValueOnce({ data: undefined });
    await verifyEmail("a token/with spaces");
    expect(mockedGet).toHaveBeenCalledWith(`/auth/verify?token=${encodeURIComponent("a token/with spaces")}`);
  });

  it("resendVerification posts the email", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await resendVerification("a@b.com");
    expect(mockedPost).toHaveBeenCalledWith("/auth/resend-verification", { email: "a@b.com" });
  });

  it("loginUser posts credentials", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await loginUser("a@b.com", "secret");
    expect(mockedPost).toHaveBeenCalledWith("/auth/login", { email: "a@b.com", password: "secret" });
  });

  it("loginUser propagates a rejected login", async () => {
    const error = { response: { status: 401 } };
    mockedPost.mockRejectedValueOnce(error);
    await expect(loginUser("a@b.com", "wrong")).rejects.toBe(error);
  });

  it("logoutUser posts with no body", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await logoutUser();
    expect(mockedPost).toHaveBeenCalledWith("/auth/logout");
  });

  it("loginWithGoogle posts the access token", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await loginWithGoogle("tok123");
    expect(mockedPost).toHaveBeenCalledWith("/auth/google", { access_token: "tok123" });
  });

  it("loginWithGitHub posts the code", async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });
    await loginWithGitHub("code123");
    expect(mockedPost).toHaveBeenCalledWith("/auth/github", { code: "code123" });
  });

  it("getCurrentUser returns the response data", async () => {
    const user = { id: 1, email: "a@b.com", created_at: "now", has_github: false };
    mockedGet.mockResolvedValueOnce({ data: user });
    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(mockedGet).toHaveBeenCalledWith("/auth/me");
  });

  it("getCurrentUser propagates errors", async () => {
    const error = { response: { status: 500 } };
    mockedGet.mockRejectedValueOnce(error);
    await expect(getCurrentUser()).rejects.toBe(error);
  });
});
