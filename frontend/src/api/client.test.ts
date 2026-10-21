import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient } from "./client";

function getRejectedHandler(): (error: any) => Promise<never> {
  const handlers = (apiClient.interceptors.response as any).handlers as Array<{
    fulfilled: (value: unknown) => unknown;
    rejected: (error: any) => Promise<never>;
  }>;
  const handler = handlers[handlers.length - 1];
  return handler.rejected;
}

describe("apiClient", () => {
  it("is configured with credentials and a base URL", () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.baseURL).toBeTruthy();
  });

  it("passes through a successful response unchanged", () => {
    const handlers = (apiClient.interceptors.response as any).handlers as Array<{
      fulfilled: (value: unknown) => unknown;
    }>;
    const fulfilled = handlers[handlers.length - 1].fulfilled;
    const response = { status: 200, data: { ok: true } };
    expect(fulfilled(response)).toBe(response);
  });
});

describe("apiClient 401 interceptor", () => {
  let originalLocation: Location;

  beforeEach(() => {
    sessionStorage.clear();
    originalLocation = window.location;
    // jsdom doesn't allow assigning to window.location.href on some setups,
    // so stub the whole object for this test.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "http://localhost/dashboard" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    sessionStorage.clear();
  });

  it("redirects to /login and clears the session-expired flag path when not previously authenticated", async () => {
    const rejected = getRejectedHandler();
    const error = { response: { status: 401 } };

    await expect(rejected(error)).rejects.toBe(error);

    expect(sessionStorage.getItem("auth_active")).toBeNull();
    expect(sessionStorage.getItem("session_expired")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("marks session_expired when a previously authenticated session gets a 401", async () => {
    sessionStorage.setItem("auth_active", "1");
    const rejected = getRejectedHandler();
    const error = { response: { status: 401 } };

    await expect(rejected(error)).rejects.toBe(error);

    expect(sessionStorage.getItem("auth_active")).toBeNull();
    expect(sessionStorage.getItem("session_expired")).toBe("1");
    expect(window.location.href).toBe("/login");
  });

  it("does not redirect for non-401 errors", async () => {
    const rejected = getRejectedHandler();
    const error = { response: { status: 500 } };

    await expect(rejected(error)).rejects.toBe(error);

    expect(window.location.href).toBe("http://localhost/dashboard");
  });

  it("does not redirect when there is no response object at all (network error)", async () => {
    const rejected = getRejectedHandler();
    const error = { message: "Network Error" };

    await expect(rejected(error)).rejects.toBe(error);

    expect(window.location.href).toBe("http://localhost/dashboard");
  });
});
