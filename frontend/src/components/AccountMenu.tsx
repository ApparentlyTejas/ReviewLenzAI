import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { avatarColor, avatarInitials } from "../lib/avatar";
import { ChevronDownIcon, HelpIcon, LogOutIcon, MoonIcon, SettingsIcon, SunIcon } from "./Icons";

/** The avatar/email in the navbar, now a proper account dropdown (avatar trigger,
 * email, settings/help, theme, and log out inside a panel) instead of everything
 * sitting exposed in the bar. */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="navbar-avatar" style={{ background: avatarColor(user.email) }}>
          {avatarInitials(user.username)}
        </span>
        <span className="navbar-user-email">{user.username}</span>
        <ChevronDownIcon size={14} />
      </button>

      {open && (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-header">
            <span className="navbar-avatar" style={{ background: avatarColor(user.email) }}>
              {avatarInitials(user.username)}
            </span>
            <div className="account-menu-identity">
              <span className="account-menu-username">{user.username}</span>
              <span className="account-menu-email">{user.email}</span>
            </div>
          </div>
          <div className="account-menu-divider" />
          <Link to="/settings" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <SettingsIcon size={15} />
            Settings
          </Link>
          <Link to="/help" className="account-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <HelpIcon size={15} />
            Help
          </Link>
          <button type="button" className="account-menu-item" role="menuitem" onClick={toggleTheme}>
            {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="account-menu-divider" />
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOutIcon size={15} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
