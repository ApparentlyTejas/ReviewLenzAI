import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { changePassword, deleteAccount, disconnectGitHub, updateUsername } from "../api/auth";
import { BackButton } from "../components/BackButton";
import { GitHubLoginButton } from "../components/GitHubLoginButton";
import { pageTransition } from "../components/pageTransition";
import { useToast } from "../components/Toast";
import { useTheme } from "../theme/ThemeContext";
import { usePageTitle } from "../hooks/usePageTitle";

export function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  usePageTitle("Settings");

  const [username, setUsername] = useState(user?.username ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  const updateUsernameMutation = useMutation({
    mutationFn: () => updateUsername(username),
    onSuccess: async () => {
      await refreshUser();
      toast("Display name updated.");
    },
    onError: () => toast("Failed to update display name. Please try again.", "error"),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      toast("Password updated.");
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      setPasswordError(err.response?.data?.detail ?? "Failed to update password.");
    },
  });

  const disconnectGitHubMutation = useMutation({
    mutationFn: disconnectGitHub,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["github-repos"] });
      toast("GitHub disconnected.");
    },
    onError: () => toast("Failed to disconnect GitHub. Please try again.", "error"),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteAccount(user?.has_password ? deletePassword : undefined),
    onSuccess: () => {
      toast("Account deleted.");
      logout();
      navigate("/");
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast(err.response?.data?.detail ?? "Failed to delete account.", "error");
    },
  });

  if (!user) return null;

  function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || username === user?.username) return;
    updateUsernameMutation.mutate();
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }
    setPasswordError(null);
    changePasswordMutation.mutate();
  }

  const deleteReady = deleteConfirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  function handleDeleteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!deleteReady) return;
    if (user!.has_password && !deletePassword) return;
    deleteAccountMutation.mutate();
  }

  return (
    <motion.div {...pageTransition}>
      <BackButton to="/projects" label="Dashboard" />
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <div className="dash-section-header">
        <h2>Account</h2>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Signed in as <strong>{user.email}</strong>
      </p>
      <form className="connect-repo-form" onSubmit={handleUsernameSubmit} style={{ maxWidth: 360, marginBottom: 28 }}>
        <label>
          Display name
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={50}
          />
        </label>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          Shown instead of your email around the app.
        </p>
        <button type="submit" className="secondary" disabled={updateUsernameMutation.isPending || username === user.username}>
          {updateUsernameMutation.isPending ? "Saving..." : "Save display name"}
        </button>
      </form>

      <div className="dash-section-header">
        <h2>Appearance</h2>
      </div>
      <div className="theme-pref-row" role="radiogroup" aria-label="Theme">
        {(["light", "dark", "system"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`theme-pref-option${preference === option ? " active" : ""}`}
            onClick={() => setPreference(option)}
            aria-pressed={preference === option}
          >
            {option === "light" ? "Light" : option === "dark" ? "Dark" : "System"}
          </button>
        ))}
      </div>

      <div className="dash-section-header" style={{ marginTop: 28 }}>
        <h2>GitHub</h2>
      </div>
      {user.has_github ? (
        <div className="settings-row">
          <p>Your GitHub account is connected.</p>
          <button
            type="button"
            className="secondary small"
            disabled={disconnectGitHubMutation.isPending}
            onClick={() => disconnectGitHubMutation.mutate()}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="settings-row">
          <p>Connect GitHub to review pull requests directly from your repos.</p>
          <GitHubLoginButton intent="connect" className="secondary small" label="Connect GitHub" />
        </div>
      )}

      {user.has_password && (
        <>
          <div className="dash-section-header" style={{ marginTop: 28 }}>
            <h2>Change password</h2>
          </div>
          <form className="connect-repo-form" onSubmit={handlePasswordSubmit} style={{ maxWidth: 360 }}>
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
            {passwordError && <p className="error">{passwordError}</p>}
            <button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Updating..." : "Update password"}
            </button>
          </form>
        </>
      )}

      <div className="dash-section-header" style={{ marginTop: 28 }}>
        <h2>Recently deleted</h2>
      </div>
      <div className="settings-row">
        <p>Disconnected repos and deleted reviews, restorable for 30 days.</p>
        <button type="button" className="secondary small" onClick={() => navigate("/settings/recently-deleted")}>
          View
        </button>
      </div>

      <div className="dash-section-header" style={{ marginTop: 28 }}>
        <h2>Danger zone</h2>
      </div>
      <div className="danger-zone">
        {!showDeleteForm ? (
          <div className="settings-row">
            <p>Permanently delete your account and every project, review, and finding tied to it.</p>
            <button type="button" className="danger small" onClick={() => setShowDeleteForm(true)}>
              Delete account
            </button>
          </div>
        ) : (
          <form className="connect-repo-form" onSubmit={handleDeleteSubmit} style={{ maxWidth: 360 }}>
            <p>
              This can't be undone. Type <strong>{user.email}</strong> to confirm.
            </p>
            <label>
              Email
              <input
                type="text"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
            {user.has_password && (
              <label>
                Password
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
            )}
            <div className="rerun-confirm-actions">
              <button
                type="submit"
                className="danger"
                disabled={!deleteReady || (user.has_password && !deletePassword) || deleteAccountMutation.isPending}
              >
                {deleteAccountMutation.isPending ? "Deleting..." : "Permanently delete account"}
              </button>
              <button type="button" className="secondary" onClick={() => setShowDeleteForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}
