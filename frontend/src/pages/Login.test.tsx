import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Login } from "./Login";

const login = vi.fn();
const loginGoogle = vi.fn();
const navigate = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ login, loginGoogle }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const resendVerification = vi.fn();
vi.mock("../api/auth", () => ({
  resendVerification: (...args: unknown[]) => resendVerification(...args),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("Login page", () => {
  it("renders the sign-in form", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
  });

  it("logs in and navigates to /projects on success", async () => {
    login.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("a@b.com", "secret"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/projects"));
  });

  it("shows an invalid-credentials error on a generic failure", async () => {
    login.mockRejectedValueOnce({ response: { status: 400 } });
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the unverified-email flow and allows resending on a 403", async () => {
    login.mockRejectedValueOnce({ response: { status: 403 } });
    resendVerification.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Please verify your email before signing in.")).toBeDefined();
    const resendButton = screen.getByRole("button", { name: "Resend verification email" });
    fireEvent.click(resendButton);

    await waitFor(() => expect(resendVerification).toHaveBeenCalledWith("a@b.com"));
    expect(await screen.findByText("Email sent!")).toBeDefined();
  });

  it("shows the session-expired banner when the flag is set", () => {
    sessionStorage.setItem("session_expired", "1");
    renderLogin();
    expect(screen.getByText("Your session expired. Please sign in again.")).toBeDefined();
    expect(sessionStorage.getItem("session_expired")).toBeNull();
  });
});
