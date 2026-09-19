import {useState, useEffect, useCallback} from "react";

export type Theme = "light" | "dark" | "system";

/** The two grounds defined in src/styles/tokens.css. */
export type Ground = "ink" | "paper";

export const THEME_STORAGE_KEY = "json-viewer-theme";

const GROUND: Record<"light" | "dark", Ground> = {light: "paper", dark: "ink"};

const systemTheme = (): "light" | "dark" =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/** The single place the ground is applied. index.html runs the same
 *  assignment inline before first paint so there is no flash. */
const applyGround = (effective: "light" | "dark") => {
  document.documentElement.dataset.mode = GROUND[effective];
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "system"
  );

  const getEffectiveTheme = useCallback(
    (): "light" | "dark" => (theme === "system" ? systemTheme() : theme),
    [theme]
  );

  useEffect(() => {
    applyGround(getEffectiveTheme());
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, getEffectiveTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyGround(getEffectiveTheme());
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, getEffectiveTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(getEffectiveTheme() === "dark" ? "light" : "dark");
  }, [getEffectiveTheme]);

  const setThemeMode = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  return {
    theme,
    effectiveTheme: getEffectiveTheme(),
    ground: GROUND[getEffectiveTheme()],
    toggleTheme,
    setTheme: setThemeMode,
    isSystemTheme: theme === "system",
  };
};
