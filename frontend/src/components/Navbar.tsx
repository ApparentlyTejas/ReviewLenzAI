import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { avatarColor, avatarInitials } from "../lib/avatar";
import { Logo } from "./Logo";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <Logo size={26} />
        ReviewLenzAI
      </Link>
      <div className="navbar-links">
        {user && (
          <span className="navbar-user">
            <span className="navbar-avatar" style={{ background: avatarColor(user.email) }}>
              {avatarInitials(user.email)}
            </span>
            {user.email}
          </span>
        )}
        <button className="secondary" onClick={logout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
