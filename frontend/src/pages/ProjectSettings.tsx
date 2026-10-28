import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import {
  disableWebhook,
  enableWebhook,
  getProjectSettings,
  getWebhookStatus,
  updateProjectSettings,
  type WebhookCreated,
} from "../api/projects";
import { BackButton } from "../components/BackButton";
import { pageTransition } from "../components/pageTransition";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { usePageTitle } from "../hooks/usePageTitle";
import type { FindingSeverity } from "../types";

const SEVERITY_OPTIONS: { value: FindingSeverity; label: string }[] = [
  { value: "low", label: "Low and up — show everything" },
  { value: "medium", label: "Medium and up" },
  { value: "high", label: "High and up" },
  { value: "critical", label: "Critical only" },
];

export function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  usePageTitle("Project settings");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["project-settings", id],
    queryFn: () => getProjectSettings(id),
  });

  const { data: webhook } = useQuery({
    queryKey: ["project-webhook", id],
    queryFn: () => getWebhookStatus(id),
  });

  const [ignorePatterns, setIgnorePatterns] = useState("");
  const [minSeverity, setMinSeverity] = useState<FindingSeverity>("low");
  const [justCreated, setJustCreated] = useState<WebhookCreated | null>(null);

  useEffect(() => {
    if (settings) {
      setIgnorePatterns(settings.ignore_patterns);
      setMinSeverity(settings.min_severity);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => updateProjectSettings(id, ignorePatterns, minSeverity),
    onSuccess: () => toast("Review settings saved."),
    onError: () => toast("Failed to save settings. Please try again.", "error"),
  });

  const enableWebhookMutation = useMutation({
    mutationFn: () => enableWebhook(id),
    onSuccess: (created) => {
      setJustCreated(created);
      queryClient.invalidateQueries({ queryKey: ["project-webhook", id] });
    },
    onError: () => toast("Failed to enable auto-review. Please try again.", "error"),
  });

  const disableWebhookMutation = useMutation({
    mutationFn: () => disableWebhook(id),
    onSuccess: () => {
      setJustCreated(null);
      queryClient.invalidateQueries({ queryKey: ["project-webhook", id] });
      toast("Auto-review disabled.");
    },
    onError: () => toast("Failed to disable auto-review. Please try again.", "error"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied.`);
    } catch {
      toast("Could not copy to clipboard.", "error");
    }
  }

  return (
    <motion.div {...pageTransition}>
      <BackButton to={`/projects/${id}`} label="Pull requests" />
      <header className="page-header">
        <h1>Review settings</h1>
      </header>
      <p className="page-subtitle" style={{ marginBottom: 28 }}>
        Controls what the next review on this repository looks at and reports.
      </p>

      {isLoading && <Spinner label="Loading settings..." />}

      {settings && (
        <form className="connect-repo-form" onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
          <label>
            Ignore patterns
            <textarea
              rows={5}
              value={ignorePatterns}
              onChange={(e) => setIgnorePatterns(e.target.value)}
              placeholder={"*.lock\ndist/*\n*.min.js"}
            />
          </label>
          <p style={{ margin: "-8px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            One glob pattern per line. Matching files are skipped entirely — the AI never sees them.
          </p>

          <label style={{ marginTop: 12 }}>
            Minimum severity
            <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as FindingSeverity)}>
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <p style={{ margin: "-8px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            Findings below this severity are discarded after the review runs.
          </p>

          <button type="submit" disabled={saveMutation.isPending} style={{ marginTop: 8 }}>
            {saveMutation.isPending ? "Saving..." : "Save settings"}
          </button>
        </form>
      )}

      <div className="dash-section-header" style={{ marginTop: 28 }}>
        <h2>Auto-review</h2>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Automatically review a pull request when it's opened or pushed to, via a GitHub webhook.
      </p>

      {webhook && !webhook.enabled && !justCreated && (
        <button
          type="button"
          className="secondary"
          disabled={enableWebhookMutation.isPending}
          onClick={() => enableWebhookMutation.mutate()}
        >
          {enableWebhookMutation.isPending ? "Enabling..." : "Enable auto-review"}
        </button>
      )}

      {justCreated && (
        <div className="webhook-setup-box">
          <p>
            <strong>Add this as a webhook</strong> on the repository: GitHub → Settings → Webhooks → Add webhook.
            Set content type to <code>application/json</code> and the event to <code>Pull requests</code>.
          </p>
          <label>
            Payload URL
            <div className="webhook-field-row">
              <input type="text" readOnly value={justCreated.webhook_url} />
              <button type="button" className="secondary small" onClick={() => copyToClipboard(justCreated.webhook_url, "URL")}>
                Copy
              </button>
            </div>
          </label>
          <label>
            Secret
            <div className="webhook-field-row">
              <input type="text" readOnly value={justCreated.secret} />
              <button type="button" className="secondary small" onClick={() => copyToClipboard(justCreated.secret, "Secret")}>
                Copy
              </button>
            </div>
          </label>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            This secret is shown only once. Regenerating it later will require updating the webhook on GitHub too.
          </p>
          <button type="button" className="secondary small" onClick={() => setJustCreated(null)}>
            Done
          </button>
        </div>
      )}

      {webhook?.enabled && !justCreated && (
        <div className="settings-row">
          <p>Auto-review is enabled for this repository.</p>
          <button
            type="button"
            className="secondary small"
            disabled={disableWebhookMutation.isPending}
            onClick={() => disableWebhookMutation.mutate()}
          >
            Disable
          </button>
        </div>
      )}
    </motion.div>
  );
}
