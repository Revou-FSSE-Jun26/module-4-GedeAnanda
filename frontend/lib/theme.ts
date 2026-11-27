/**
 * The colour theme in the browser. This module is the only place that reads or
 * writes the `revotask_theme` cookie and the `data-theme` attribute on the
 * client; the root layout reads the same cookie on the server (REQ-33.2).
 */

export type Theme = "light" | "dark";

export const THEME_COOKIE = "revotask_theme";
const CHANGE_EVENT = "revotask:theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** The theme on screen now: the user's choice, or the operating system's setting. */
export function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (isTheme(chosen)) return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Switch theme now and remember the choice for later page loads. */
export function chooseTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Call `onChange` whenever the theme on screen may have changed. Returns the cleanup. */
export function watchTheme(onChange: () => void): () => void {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(CHANGE_EVENT, onChange);
  system.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    system.removeEventListener("change", onChange);
  };
}
