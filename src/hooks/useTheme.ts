import {useState, useEffect, useCallback} from "react";

export type Theme = "light" | "dark" | "system";

/** The two grounds defined in src/styles/tokens.css. */
export type Ground = "ink" | "paper";

export const THEME_STORAGE_KEY = "json-viewer-theme";

const GROUND: Record<"light" | "dark", Ground> = {light: "paper", dark: "ink"};

const systemTheme = (): "light" | "dark" =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/* Storage is a preference, never a dependency. It throws outright where site
   data is blocked, and a theme that cannot be remembered is not a reason to
   fail to render. */
const readStored = (): Theme | null => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  } catch {
    return null;
  }
};

const writeStored = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* nothing to do — the ground still applies for this session */
  }
};

/** The single place the ground is applied. index.html runs the same
 *  assignment inline before first paint so there is no flash. */
const applyGround = (effective: "light" | "dark") => {
  document.documentElement.dataset.mode = GROUND[effective];
};

const currentGround = (): Ground =>
  document.documentElement.dataset.mode === "paper" ? "paper" : "ink";

/**
 * The ground that is actually applied, for the handful of consumers that take
 * a value rather than a `var()` — a library prop, a canvas rasteriser.
 *
 * It reads `html[data-mode]` rather than calling `useTheme`, because every
 * `useTheme` call is its own `useState` and only the instance that was clicked
 * would update. The attribute is the one thing they all agree on, and it moves
 * for a system change as well as for a click.
 */
export const useGround = (): Ground => {
  const [ground, setGround] = useState(currentGround);
  useEffect(() => {
    const obs = new MutationObserver(() => setGround(currentGround()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode"],
    });
    // The attribute may have moved between first render and this effect.
    setGround(currentGround());
    return () => obs.disconnect();
  }, []);
  return ground;
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => readStored() || "system");
  const ground = useGround();

  const getEffectiveTheme = useCallback(
    (): "light" | "dark" => (theme === "system" ? systemTheme() : theme),
    [theme]
  );

  useEffect(() => {
    applyGround(getEffectiveTheme());
    writeStored(theme);
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
    ground,
    toggleTheme,
    setTheme: setThemeMode,
    isSystemTheme: theme === "system",
  };
};
