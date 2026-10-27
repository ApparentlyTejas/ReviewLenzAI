import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { GoogleLoginButton } from "../components/GoogleLoginButton";
import { GitHubLoginButton } from "../components/GitHubLoginButton";
import { Logo } from "../components/Logo";

const checks = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character (!@#$...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function Register() {
  const { loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordValid = checks.every(c => c.test(password));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passwordValid) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await registerUser(email, password);
      navigate("/login");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        setError("An account with this email already exists. Try signing in.");
      } else if (status === 422) {
        const detail = err?.response?.data?.detail;
        const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
        setError(msg ?? "Registration failed. Please try again.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSuccess(accessToken: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginGoogle(accessToken);
      navigate("/projects");
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-dark">
      <div className="auth-glow-1" />
      <div className="auth-glow-2" />
      <div className="auth-glow-3" />

      <motion.div
        className="auth-glass"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link to="/" className="auth-glass-brand">
          <Logo size={28} />
          ReviewLenzAI
        </Link>

        <h1>Create account</h1>
        <p className="auth-dark-sub">Start reviewing code with AI</p>

        <GoogleLoginButton
          onSuccess={handleGoogleSuccess}
          onError={() => setError("Google sign-in failed. Please try again.")}
          disabled={isSubmitting}
        />
        <GitHubLoginButton disabled={isSubmitting} />

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={handleSubmit} style={{ marginBottom: 0 }}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                autoComplete="new-password"
                style={{ width: "100%", paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 4, cursor: "pointer", color: "rgba(255,255,255,0.4)", width: "auto" }}>
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </label>

          {(passwordFocused || password.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, margin: "6px 0 10px", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
              {checks.map(c => {
                const met = c.test(password);
                return (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: met ? "#34c759" : "rgba(255,255,255,0.35)" }}>
                    <span style={{ fontSize: 10 }}>{met ? "✓" : "○"}</span>
                    {c.label}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={isSubmitting || !passwordValid} style={{ width: "100%", marginTop: 4 }}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.35)", margin: "20px 0 0" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "rgba(255,255,255,0.75)" }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
