export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function getThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall through to the default.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Not persisted, but still applied for this visit.
  }
  applyTheme(pref);
}

// Re-applies the theme when the OS switches between light and dark while the
// preference is "system". Returns a function that stops watching.
export function watchSystemTheme(): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getThemePref() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
