import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";

interface ThemeContextValue {
  /** The resolved theme actually applied to the page. */
  theme: Theme;
  /** What's stored: an explicit choice, or "system" (follow the OS, live). */
  preference: ThemePreference;
  /** Quick binary flip for the navbar icon — always makes an explicit choice. */
  toggleTheme: () => void;
  /** Full three-way control for the Settings page. */
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedPreference(): ThemePreference {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

// Mirrors the inline script in index.html that sets this before first paint, so
// mount never causes a flash from the wrong theme to the right one.
function initialTheme(): Theme {
  const pref = storedPreference();
  return pref === "system" ? systemTheme() : pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [preference, setPreferenceState] = useState<ThemePreference>(storedPreference);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    // Only follow the OS live when the preference is "system".
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(systemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function setPreference(pref: ThemePreference) {
    if (pref === "system") {
      localStorage.removeItem("theme");
      setPreferenceState("system");
      setTheme(systemTheme());
    } else {
      localStorage.setItem("theme", pref);
      setPreferenceState(pref);
      setTheme(pref);
    }
  }

  function toggleTheme() {
    setPreference(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
