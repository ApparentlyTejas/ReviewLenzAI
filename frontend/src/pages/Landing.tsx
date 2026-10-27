import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ScrollReveal } from "../components/ScrollReveal";
import { ConnectIcon, LockIcon, UserIcon } from "../components/Icons";
import { Logo } from "../components/Logo";
import { useAuth } from "../auth/AuthContext";

const STACK = [
  { key: "backend", val: "Python 3.12 · FastAPI · SQLAlchemy · Pydantic v2" },
  { key: "auth", val: "GitHub OAuth · Google OAuth · JWT · bcrypt · Fernet encryption" },
  { key: "database", val: "PostgreSQL (Neon on prod)" },
  { key: "llm", val: "Groq API · enforced structured output" },
  { key: "frontend", val: "React 19 · TypeScript · Vite · TanStack Query · Framer Motion" },
  { key: "email", val: "Brevo transactional email" },
  { key: "deploy", val: "Render · Neon · Vercel · GitHub Actions CI" },
];

export function Landing() {
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);

  return (
    <motion.div className="landing" exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <nav className="landing-nav">
        <span className="landing-nav-brand">
          <Logo size={26} />
          ReviewLenzAI
        </span>
        <div className="landing-nav-center">
          <a href="#connect">How it works</a>
          <a href="#review">Review</a>
          <a href="#stack">Stack</a>
        </div>
        <div className="landing-nav-links">
          <a href="https://github.com/ApparentlyTejas/ai-code-review-assistant" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
          {user ? (
            <Link to="/projects" className="btn-pill" style={{ padding: "8px 18px", fontSize: 13 }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register" className="btn-pill" style={{ padding: "8px 18px", fontSize: 13 }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="hero" ref={heroRef}>
        <motion.div className="hero-glow" style={{ y: glowY }} />
        <motion.div className="hero-content" style={{ opacity: heroOpacity, scale: heroScale }}>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Catch the bugs
            <br />
            your reviewers miss.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Sign in with GitHub or Google, browse your repos, pick an open PR, and in about 20 seconds
            you get a full breakdown: what's broken, what's a security hole, and what's just sloppy.
            Ranked by how bad it actually is.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <Link to={user ? "/projects" : "/register"} className="btn-pill">
              {user ? "Go to dashboard" : "Start reviewing →"}
            </Link>
            {!user && (
              <Link to="/login" className="btn-pill outline">
                Log in
              </Link>
            )}
          </motion.div>
        </motion.div>
        <motion.div
          className="hero-scroll-cue"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          Scroll to explore ↓
        </motion.div>
      </div>

      <section className="section" id="connect">
        <ScrollReveal>
          <h2>
            Connect GitHub.
            <br />
            Pick a PR. Done.
          </h2>
          <p className="lead">
            Sign in with GitHub or Google. Browse your repos directly from the dashboard, no token
            pasting, no manual setup. Just pick a repo and an open PR.
          </p>
        </ScrollReveal>
        <div className="feature-grid">
          <ScrollReveal delay={0}>
            <div className="feature-card">
              <span className="feature-icon">
                <ConnectIcon />
              </span>
              <h3>GitHub & Google login</h3>
              <p>
                Sign in with your GitHub or Google account in one click. Your repos are instantly available — no personal access tokens needed.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="feature-card">
              <span className="feature-icon">
                <LockIcon />
              </span>
              <h3>Secure by design</h3>
              <p>
                All tokens encrypted with Fernet before touching the database. HttpOnly cookies, bcrypt passwords, and rate limiting on every endpoint.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="feature-card">
              <span className="feature-icon">
                <UserIcon />
              </span>
              <h3>Private by default</h3>
              <p>
                Your projects and reviews only appear on your account. No shared access, no team view, no accidental leaks.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="section section-dark" id="review">
        <ScrollReveal>
          <h2>
            Not "looks suspicious."
            <br />
            Exactly what. Exactly where.
          </h2>
          <p className="lead">
            The diff goes to the LLM with a strict output format. No free-form guessing.
            Just category, severity, file path, line number, and a concrete fix.
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.15}>
          <div className="mock-finding-wrapper">
            <div className="mock-finding-glow" />
            <div className="mock-finding-card">
              <div className="mock-finding-chrome">
                <span className="mock-finding-dot" style={{ background: "#ff5f57" }} />
                <span className="mock-finding-dot" style={{ background: "#febc2e" }} />
                <span className="mock-finding-dot" style={{ background: "#28c840" }} />
                <span className="mock-finding-chrome-label">Review result</span>
              </div>
              <div className="mock-finding-body">
                <div className="finding-header">
                  <span className="badge">security</span>
                  <span className="badge">critical</span>
                  <code>app/services/db.py:42</code>
                </div>
                <p style={{ margin: 0 }}>
                  User input is concatenated directly into a SQL query, exposing the endpoint to injection attacks.
                </p>
                <p className="mock-finding-fix">
                  Suggested fix: use parameterized queries. If you're on SQLAlchemy's ORM this is
                  handled for you, which means raw SQL is sneaking in somewhere it shouldn't.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="section" id="stack">
        <ScrollReveal>
          <h2>No magic. Just solid choices.</h2>
          <p className="lead">
            Proper auth, encrypted secrets, a real database, and an actual LLM doing the work.
            No shortcuts taken on the boring parts.
          </p>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="stack-code-block">
            {STACK.map(({ key, val }) => (
              <div key={key} className="stack-code-row">
                <span className="stack-code-key">{key}</span>
                <span className="stack-code-val">{val}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <section className="cta-section">
        <ScrollReveal>
          <h2>Run it on your next PR.</h2>
          <Link
            to={user ? "/projects" : "/register"}
            className="btn-pill"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {user ? "Go to dashboard" : "Connect a repo →"}
          </Link>
        </ScrollReveal>
      </section>

      <footer className="landing-footer">
        <p>
          Built by{" "}
          <a href="https://github.com/ApparentlyTejas" target="_blank" rel="noreferrer">
            @ApparentlyTejas
          </a>
        </p>
      </footer>
    </motion.div>
  );
}
