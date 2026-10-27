import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { AlertCircleIcon, CheckCircleIcon } from "../components/Icons";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/Spinner";

type State = "verifying" | "success" | "error";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login: _login } = useAuth();
  const [state, setState] = useState<State>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      setErrorMsg("No verification token found in the link.");
      return;
    }

    verifyEmail(token)
      .then(() => {
        // Cookie is set by the backend — sync auth state
        sessionStorage.setItem("auth_active", "1");
        setState("success");
        setTimeout(() => navigate("/projects"), 2000);
      })
      .catch((err: any) => {
        const detail = err?.response?.data?.detail ?? "Invalid or expired verification link.";
        setErrorMsg(detail);
        setState("error");
      });
  }, []);

  return (
    <div className="auth-dark">
      <div className="auth-glow-1" />
      <div className="auth-glow-2" />
      <div className="auth-glow-3" />

      <motion.div
        className="auth-glass"
        style={{ textAlign: "center" }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link to="/" className="auth-glass-brand">
          <Logo size={28} />
          ReviewLenzAI
        </Link>

        {state === "verifying" && (
          <>
            <div className="auth-status-icon" style={{ color: "rgba(255,255,255,0.6)" }}>
              <Spinner />
            </div>
            <h1>Verifying…</h1>
            <p className="auth-dark-sub">Just a moment while we confirm your email.</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="auth-status-icon" style={{ color: "#34c759" }}>
              <CheckCircleIcon />
            </div>
            <h1>Email verified!</h1>
            <p className="auth-dark-sub">Your account is active. Taking you to your projects…</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="auth-status-icon" style={{ color: "#ff3b30" }}>
              <AlertCircleIcon />
            </div>
            <h1>Verification failed</h1>
            <p className="auth-dark-sub">{errorMsg}</p>
            <p style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.35)", margin: "20px 0 0" }}>
              <Link to="/register" style={{ color: "rgba(255,255,255,0.75)" }}>Register again</Link>
              {" · "}
              <Link to="/login" style={{ color: "rgba(255,255,255,0.75)" }}>Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
