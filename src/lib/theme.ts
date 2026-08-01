/**
 * Theme preference helpers — pure & testable; no DOM.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "kapan-lari-theme";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

/** Stored preference wins; otherwise follow system preference. */
export function resolveTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

export function nextTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}
