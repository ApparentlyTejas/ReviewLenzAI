import { motion } from "framer-motion";
import { BackButton } from "../components/BackButton";
import { pageTransition } from "../components/pageTransition";
import { usePageTitle } from "../hooks/usePageTitle";

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I review a pull request?",
    a: 'Connect a repository from the dashboard, open it, and click "Review this PR" on any open pull request. A review usually finishes in under 20 seconds.',
  },
  {
    q: "What do the severity levels mean?",
    a: "Critical and high findings are bugs or security issues worth fixing before merging. Medium and low findings are style or maintainability suggestions, worth a look but not blockers.",
  },
  {
    q: "Can I ask follow-up questions about a finding?",
    a: 'Yes. Open any completed review and click "Ask about this" on a finding, or use the chat panel on the review page to ask anything about that PR’s diff.',
  },
  {
    q: "What's the dashboard chat for?",
    a: "It answers questions across every repo you've connected, things like \"what critical issues do I have?\" or \"summarize my last review.\"",
  },
  {
    q: "How do I disconnect a repository?",
    a: 'On the dashboard, find the repo in the project list and click "Disconnect." This removes the repo and its reviews from your account; it doesn’t affect anything on GitHub.',
  },
  {
    q: "Do you store my code?",
    a: "Only the diff of the pull request being reviewed, long enough to generate and show you the findings. Nothing is used to train models.",
  },
];

export function Help() {
  usePageTitle("Help");

  return (
    <motion.div {...pageTransition}>
      <BackButton to="/projects" label="Dashboard" />
      <header className="page-header">
        <h1>Help</h1>
      </header>

      <ul className="finding-list">
        {FAQ.map(({ q, a }) => (
          <li key={q} className="finding" style={{ borderLeftColor: "var(--accent)" }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>{q}</p>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>{a}</p>
          </li>
        ))}
      </ul>

      <p className="page-subtitle" style={{ marginTop: 28 }}>
        Something not covered here? Open an issue on{" "}
        <a href="https://github.com/ApparentlyTejas/ai-code-review-assistant" target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </p>
    </motion.div>
  );
}
