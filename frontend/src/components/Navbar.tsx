import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { SearchIcon } from "./Icons";
import { AccountMenu } from "./AccountMenu";

export function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <Logo size={26} />
        <span>ReviewLenzAI</span>
      </Link>
      <div className="navbar-links">
        <button
          type="button"
          className="cmdk-trigger"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        >
          <SearchIcon size={14} />
          <span className="cmdk-trigger-label">Search</span>
          <kbd>⌘K</kbd>
        </button>
        <AccountMenu />
      </div>
    </nav>
  );
}
